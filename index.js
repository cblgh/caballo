const hyperswarm = require("hyperswarm-web")
const crypto = require("hypercore-crypto")
const ram = require("random-access-memory")
const hypercore = require("hypercore")
const pump = require("pump")

const key = "13379ad64e284691b7c6f6310e39204b5f92765e36102046caaa6a7ff8c02d74"
const discoveryKey = crypto.discoveryKey(Buffer.from(key, 'hex'))

const swarm = hyperswarm()
const feed = hypercore(ram)
feed.on("ready", initiate)

const chatHandler = {
    encoding: "utf-8",
    onmessage (msg, peer) {
        addMessage(msg)
    },
    onerror (err) {
        console.error("EXTMSG ERR", err)
    }
}

function addMessage (msg) {
    const prev = document.getElementById("chat").textContent 
    document.getElementById("chat").textContent = msg + "\n" + prev
}

function setName (name) {
    document.getElementById("name").value = name
}

function initiate () {
    const pubkey = feed.key.toString("hex")
    setName(pubkey.slice(0, 8))
    console.log("my feed key is", pubkey)

    swarm.join(discoveryKey, { lookup: true, announce: true })
    swarm.on("connection", (socket, info) => {
        console.log("connection!")
        const peer = info.peer
        const r = feed.replicate(info.client)

        pump(socket, r, socket, (err) => {
            if (err) console.error("ERROR", err)
        })

        const ext = r.registerExtension("chatting", chatHandler)

        setInterval(() => {
            console.log("trying to send message")
            ext.send(pubkey.slice(0, 8) + ": hello!!")
        }, 1000)

        console.log(peer)
        console.log(socket)
        console.log(info)
        console.log()
    })
}
