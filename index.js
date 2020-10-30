const hyperswarm = require("hyperswarm-web")
const crypto = require("hypercore-crypto")
const ram = require("random-access-memory")
const hypercore = require("hypercore")
const pump = require("pump")

const key = "13379ad64e284691b7c6f6310e39204b5f92765e36102046caaa6a7ff8c02d74"
const discoveryKey = crypto.discoveryKey(Buffer.from(key, 'hex'))

const swarm = hyperswarm()

console.log("About to load kappa-core")
const kappa = require('kappa-core')
console.log("Loaded kappa-core")

const view = require('kappa-view')

console.log("Initialising kappa-core")
const core = kappa(ram, { valueEncoding: 'json' })
console.log("Finished initialising kappa-core")

const toPull = require('stream-to-pull-stream')
const pull = require('pull-stream')

var levelup = require('levelup')
var leveljs = require('level-js')

var store = levelup(leveljs("bigdata"))

var Pushable = require('pull-pushable')

function makeMessageModel(messageText) {
    return {
        message: messageText,
        date: Date.now()
    }
}

console.log("About to intialise view")
var chatView = view(store, function (db) {

    return {
        map: function(entries, next) {
            console.log("Mapping...")

            const newDbEntries = entries.map(element => {
                const coreId = element.key;
                const value = element.value;
                value.feedId = coreId

                const entry = {
                    type: 'put',
                    // level DB sorts lexigraphically for streams, so we store by date and the coreId to make it unique
                    // todo: think of edge cases
                    key: value.date + coreId,
                    value: JSON.stringify(value)
                }

                return entry
            });

            db.batch(newDbEntries, next)
        },
        api: {
            // We could choose to add some options to only get the latest messages + newly arriving ones in the future,
            // and pull older ones while scrolling up in the future. Using pull-stream because I'm familiar with the interface
            // and i find it more composable than traditional node streams. just sketching for now
            getMessageStream: function (core, cb) {

                const p = Pushable()

                db.createReadStream({live: true })
                    .on('data', function (data) {
                        p.push(data)
                    })
                    .on('end', function() {
                        console.log("Old DB stream end!")

                        db.on('batch', function (value) {
                            console.log("Batch event value: ")
                            console.log(value)

                            value.forEach(p.push)
                        })
        

                    })

                cb(null, p)
            }
        }
    }
})

core.use('kv', chatView)

function addMessage (msg) {
    const prev = document.getElementById("chat").textContent 
    document.getElementById("chat").textContent = prev + "\n" + msg
}

function setName (name) {
    document.getElementById("name").value = name
}

function initiate () {

    core.api.kv.getMessageStream(function(err, stream) {
        console.log("Subbing to DB stream of messages")

        // Add messages in order of client's message date claim to the chat box
        pull(stream, pull.drain(function(data) {
            console.log("Drain...")
            console.log(data)

            const payload = JSON.parse(data.value)
            addMessage(
                payload.feedId + ": " + payload.message
            )
        }))

    })

    core.writer('default', function(err, writer) {
        const pubkey = writer.key.toString("hex")
        setName(pubkey.slice(0, 8))
        console.log("my feed key is", pubkey)
    
        swarm.join(discoveryKey, { lookup: true, announce: true })
        swarm.on("connection", (socket, info) => {
            console.log("connection!")
            const peer = info.peer
            const r = core.replicate(info.client)
    
            pump(socket, r, socket, (err) => {
                if (err) console.error("ERROR", err)
            })        
        })

        addMessageSendHandler(writer)
    })

    function addMessageSendHandler(writer) {
        console.log("Starting enter key listener on message input box.")
        const node = document.getElementById("input");
        node.addEventListener("keyup", function(event) {
            if (event.key === "Enter") {
                console.log("Adding my own message to core!")

                const messageText = node.value
                const messageValue = makeMessageModel(messageText)

                writer.append(messageValue)

                node.value = ""
            }
        });
    }
  
}

initiate()
