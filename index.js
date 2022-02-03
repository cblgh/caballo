const hyperswarm = require("hyperswarm-web")
const Client = require("cabal-client")

const urlParams = new URLSearchParams(window.location.search)
const useRamStorage = urlParams.get('ram') && urlParams.get('ram').toLowerCase() == "true"
if (useRamStorage) { log("Using RAM storage") }

const DEBUG_STUFF = true

const key = urlParams.get('key') || "13379ad64e284691b7c6f6310e39204b5f92765e36102046caaa6a7ff8c02d74"
let bootstrap = ["wss://swarm.cblgh.org", "wss://hyperswarm.linkping.org"]
if (urlParams.get('bootstrap')) {
  bootstrap = bootstrap.concat(urlParams.get("bootstrap"))
}
const hyperswarmWebOpts = { bootstrap }
const client = new Client({ config: { swarm: hyperswarmWebOpts, dbdir: "caballo"+key, temp: useRamStorage }})

function log () {
  if (DEBUG_STUFF) {
    console.log(...arguments)
  }
}

client.addCabal(key).then((details) => {
  // start pulling down information :>
  log("cabal is ready")
  initiate(details)
  details.getLocalUser((user) => {
    setName(user.key.slice(0, 8))
  })

  details.on("started-peering", (k) => {
    log("new peer", k)
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
    log("add msg", msg)
    const prev = document.getElementById("chat").textContent 
    // place new messages at the top, so we don't have to attach autoscrolling javascript to the textarea
    document.getElementById("chat").textContent = msg + "\n" + prev 
}

function setName (name) {
    document.getElementById("name").value = name
}

function initiate (details) {
  function handleEnvelope (env) {
    const isTrash = (!env || !env.message || !env.message.key)
    if (isTrash) return
    const message = env.message
    let name = message.key.slice(0, 8)
    if (env.author && env.author.name && env.author.name.length < 60) name = env.author.name
    const text = `[${env.channel}] ${name}: ${message.value.content.text}`
    addMessage(text)
  }

  // the read stream api doesn't return the user as part of an envelope object, so we gotta handle those messages separately
  function handleMessage (msg) {
    const isTrash = (!msg || !msg.key)
    if (isTrash) return
    let name = msg.key.slice(0, 8)
    // get author info via cabal-client using their pubkey `msg.key`
    const users = details.getUsers()
    const user = users[msg.key]
    log(user)
    if (user && user.name && user.name.length < 60) name = user.name
    const text = `[${msg.value.content.channel}] ${name}: ${msg.value.content.text}`
    addMessage(text)
  }

  // load historic data onto page; 
  // only grab 25 messages though in case someone is using caballo as a main client (not recommended!!)
  const rs = details._cabal.messages.read("default", { reverse: false, limit: 25 })
  rs.on("data", handleMessage) 
  details.on("new-message", handleEnvelope)
  addMessageSendHandler(details)
  addNickChangeHandler(details)
}

function addMessageSendHandler (details) {
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

function addNickChangeHandler (details) {
  const nickbox = document.getElementById("name")
  let nickname = nickbox.value

  // trigger publish of new nick when chatter navigates away from the nick box
  nickbox.addEventListener("blur", () => {
    if (nickbox.value !== nickname) {
      details.publishNick(nickbox.value)
      nickname = nickbox.value
    }
  })

  nickbox.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      // publish new nick to swarm
      details.publishNick(nickbox.value)
      nickname = nickbox.value
    }
  })
}
