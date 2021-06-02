const hyperswarm = require("hyperswarm-web")
const Client = require("cabal-client")

const urlParams = new URLSearchParams(window.location.search)
const useRamStorage = urlParams.get('ram') && urlParams.get('ram').toLowerCase() == "true"
const RAW = require("random-access-web")
if (useRamStorage) { console.log("Using RAM storage") }

let key = urlParams.get('key') || "13379ad64e284691b7c6f6310e39204b5f92765e36102046caaa6a7ff8c02d74"
const hyperswarmWebOpts = { bootstrap: ["wss://swarm.cblgh.org"] }
const client = new Client({ config: { storage: RAW("caballo"+key), swarm: hyperswarmWebOpts, dbdir: "caballo"+key, temp: useRamStorage }})

// TODO: expand default bootstrap list to multiple confirmed & reliable nodes
if (urlParams.get('bootstrap')) {
  hyperswarmWebOpts.bootstrap = ["wss://swarm.cblgh.org"].concat(urlParams.get("bootstrap"))
}

client.addCabal(key, { swarm: hyperswarmWebOpts }).then((details) => {
  // start pulling down information :>
  console.log("cabal is ready")
  initiate(details)
  details.getLocalUser((user) => {
    setName(user.key.slice(0, 8))
  })

  details.on("started-peering", (k) => {
    console.log("new peer", k)
  })
})

function makeMessage(messageText) {
    return {
      type: "chat/text",
      content: {
        text: messageText,
        channel: "default"
      }
    }
}

function addMessage (msg) {
    const prev = document.getElementById("chat").textContent 
    // place new messages at the top, so we don't have to attach autoscrolling javascript to the textarea
    document.getElementById("chat").textContent = msg + "\n" + prev 
}

function setName (name) {
    document.getElementById("name").value = name
}

function initiate (details) {
  function handleMessage (env) {
    if (!env || !env.message || !env.message.key) return
    const message = env.message
    let name = message.key.slice(0, 8)
    if (env.author && env.author.name && env.author.name.length < 60) name = env.author.name
    const text = `[${env.channel}] ${name}: ${message.value.content.text}`
    addMessage(text)
  }

  // load historic data onto page
  const rs = details._cabal.messages.read("default", { reverse: false })
  rs.on("data", handleMessage) 
  details.on("new-message", handleMessage)
  addMessageSendHandler(details)
}

function addMessageSendHandler(details) {
  const chatbox = document.getElementById("input")
  chatbox.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      const messageText = chatbox.value
      // publish to swarm
      details.publishMessage(makeMessage(messageText))
      const key = document.getElementById("name").value
      // clear chat box
      chatbox.value = ""
    }
  })
}
