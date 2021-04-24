const hyperswarm = require("hyperswarm-web")
const RAW = require("random-access-web")
const ram = require("random-access-memory")
const Cabal = require("cabal-core")

const urlParams = new URLSearchParams(window.location.search)
const useRamStorage = urlParams.get('ram') && urlParams.get('ram').toLowerCase() == "true"
console.log("Using RAM storage: " + useRamStorage)

const key = "13379ad64e284691b7c6f6310e39204b5f92765e36102046caaa6a7ff8c02d74"
const hyperswarmWebOpts = { bootstrap: ["wss://swarm.cblgh.org"] }
const cabalStorage = useRamStorage ? ram : RAW("caballo-cabal")
const cabal = Cabal(cabalStorage, key)

console.log("cabal, before ready")
cabal.ready(() => {
  console.log("cabal ready")
  // start pulling down information :>
  initiate()
  cabal.getLocalKey((err, localkey) => {
    console.log("hey cabal-core is alive, my local key is ", localkey) 
    setName(localkey.slice(0, 8))
  })

  cabal.on("peer-added", (k) => {
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

function initiate () {
  console.log("cabal-web initiating")

  function handleMessage (message) {
    const text = message.value.content.text
    addMessage(message.key.slice(0, 8) + ": " + text)
  }

  // load historic data onto page
  const rs = cabal.messages.read("default")
  rs.on("data", handleMessage) 

  cabal.messages.events.on("default", handleMessage)

  cabal.swarm(hyperswarmWebOpts)
  console.log("cabal-web finished initiating")
  addMessageSendHandler()
}

function addMessageSendHandler() {
  const chatbox = document.getElementById("input")
  console.log("adding key listener on message input box")
  chatbox.addEventListener("keyup", function(event) {
    if (event.key === "Enter") {
      console.log("adding mine own message to cabal-core!")
      const messageText = chatbox.value
      // publish to swarm
      cabal.publish(makeMessage(messageText))
      const key = document.getElementById("name").value
      // clear chat box
      chatbox.value = ""
    }
  })
}
