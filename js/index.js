var socket = null
var connected = false
var authfail = false
var msgcontainer = false
var gethistory = true

function auth() {
  authfail = false
  payload = {
    email: $("#email").val(),
    password: $("#password").val()
  }
  $.ajax({
    type: "POST",
    url: "/auth",
    data: JSON.stringify(payload),
    contentType: "application/json; charset=utf-8",
    success: function(data){
      console.log("Successfully authenticated!")
      connect()
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("Authentication failed: " + textStatus)
      authfail = true
    }
  });
}

function checkAuth(){
  authfail = false
  $.ajax({
    type: "GET",
    url: "/authcheck",
    success: function(data){
      if (data == "true") {
        connect()
      } else {
        authfail = true
        $("#container").loadTemplate($("#template-login"), {})
        msgcontainer = false
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("Auth check failed: " + textStatus)
      authfail = true
      $("#container").loadTemplate($("#template-login"), {})
      console.log(jqXHR)
    }
  });
}

function connect() {
  console.log("Connecting to socket...")
  socket = new WebSocket('ws://127.0.0.1/socket');

  socket.onopen = function() {
    if (!msgcontainer) {
      $("#container").loadTemplate($("#template-main"), {})
      msgcontainer = true
    }

    $("#messages").loadTemplate($("#template-success"), {
      message: "<b>Connected to server.<b>"
    }, {append: true})
    scrollDown()

    $('#message-send').removeAttr('disabled')
    $('#message-text').removeAttr('disabled')

    console.log("Connected!")
    connected = true

    if (gethistory) {
      history(1024)
      gethistory = false
    }
  };

  socket.onmessage = function (evt) {
    var data = JSON.parse(evt.data)
    receive(data.network, data.channel, data.timestamp, data.sender, data.command, data.message)
  };

  socket.onclose = function() {
    if (connected) {
      connected = false

      $("#messages").loadTemplate($("#template-error"), {
        message: "<b>Disconnected from server!</b>"
      }, {append: true})
      scrollDown()
      $('#message-send').attr('disabled', true)
      $('#message-text').attr('disabled', true)

      console.log("Disconnected!")
    }
    if (!authfail) {
      setTimeout(function() {
        connect();
      }, 5000)
    }
  };
}

function history(n){
  $.ajax({
    type: "GET",
    url: "/history?n=" + n,
    dataType: "json",
    success: function(data){
      data.reverse().forEach(function(val, i, arr) {
        receive(val.network, val.channel, val.timestamp, val.sender, val.command, val.message)
      })
      scrollDown()
    },
    error: function(jqXHR, textStatus, errorThrown) {
      $("#messages").loadTemplate($("#template-error"), {
        message: "Failed to fetch history: " + textStatus
      }, {append: true})
      scrollDown()
      console.log(jqXHR)
    }
  });
}

function getActiveChannel(){
  let active = $(".channel-messages:visible")
  if (active.length) {
    let id = active.attr('id')
    if (id.length > 5) {
      return id.substring(5, id.length)
    }
  }
  return ""
}

function switchTo(channel) {
  console.log("Switching to " + channel)
  $(".channel-messages:visible").attr("hidden", true)
  var newChan = $("#chan-" + channel.replace("#", "\\#"))
  newChan.removeAttr("hidden")
  $("#switchto-" + channel.replace("#", "\\#")).removeClass("new-messages")
  scrollDown()
}

function receive(network, channel, timestamp, sender, command, message){
  var chanObj = $("#chan-" + channel.replace("#", "\\#"))
  if (chanObj.length == 0) {
    console.log(chanObj)
    //console.log("Creating channel objects for " + channel)
    $("#messages").loadTemplate($("#template-channel-messages"), {
      channel: "chan-" + channel
    }, {append: true, isFile: false, async: false})
    $("#channels").loadTemplate($("#template-channel-switcher"), {
      channel: "switchto-" + channel,
      channelname: channel,
      onclick: "switchTo('" + channel + "')"
    }, {append: true, isFile: false, async: false})
    chanObj = $("#chan-" + channel.replace("#", "\\#"))
  }
  if (command == "privmsg") {
    chanObj.loadTemplate($("#template-message"), {
      sender: sender,
      date: moment(timestamp * 1000).format("HH:mm:ss"),
      message: message
    }, {append: true, isFile: false, async: false})
  } else if (command == "action") {
    chanObj.loadTemplate($("#template-action"), {
      sender: sender,
      date: moment(timestamp * 1000).format("HH:mm:ss"),
      message: message
    }, {append: true, isFile: false, async: false})
  } else if (command == "join" || command == "part") {
    chanObj.loadTemplate($("#template-joinpart"), {
      sender: sender,
      date: moment(timestamp * 1000).format("HH:mm:ss"),
      message: (command == "join" ? "joined " : "left: ") + message
    }, {append: true, isFile: false, async: false})
  }

  if (chanObj.attr("hidden") !== undefined){
    $("#switchto-" + channel.replace("#", "\\#")).addClass("new-messages")
  } else {
    scrollDown()
  }
}

function scrollDown(){
  $("#messages").scrollTop($("#messages")[0].scrollHeight);
}

function send(){
  if (!connected) {
    console.log("Tried to send message without connection!")
    return
  }

  var msg = $("#message-text").val()

  if (msg.startsWith("/")) {
    var args = msg.split(" ")
    command = args[0].substring(1, args[0].length)
    if (args.length > 1) {
      args = args.slice(1, args.length)
    } else {
      args = []
    }

    switch(command) {
    case "me":
      var payload = {
        network: "pvlnet",
        channel: getActiveChannel(),
        command: "action",
        message: args.join(" ")
      }
      break
    case "msg":
    case "message":
    case "query":
    case "q":
    case "privmsg":
      if (args.length > 1) {
        var payload = {
          network: "pvlnet",
          channel: args[0],
          command: "privmsg",
          message: args.slice(1, args.length).join(" ")
        }
        break
      }
    default:
      $("#messages").loadTemplate($("#template-error"), {
        message: "Unknown command: " + command
      }, {append: true})
      scrollDown();
      $("#message-text").val("")
    }
  } else {
    var payload = {
      network: "pvlnet",
      channel: getActiveChannel(),
      command: "privmsg",
      message: msg
    }
  }

  if (payload != null) {
    var content = JSON.stringify(payload)

    if (content.length > 1024) {
      $("#messages").loadTemplate($("#template-error"), {
        message: "Message too long!"
      }, {append: true})
      scrollDown();
    } else {
      socket.send(content)
      $("#message-text").val("")
    }
  }
}

checkAuth()
