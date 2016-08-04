// mauIRC - The original mauIRC web frontend
// Copyright (C) 2016 Tulir Asokan

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

function connect() {
  "use strict"
  dbg("Connecting to socket...")
  socket = new WebSocket(websocketPath)

  socket.onopen = function() {
    "use strict"
    if (!msgcontainer) {
      $("#container").loadTemplate($("#template-main"), {version: version}, {append: false, isFile: false, async: false})

      msgcontainer = true
    }

    $("#disconnected").addClass("hidden")

    connected = true
  }

  socket.onmessage = function (evt) {
    "use strict"
    var ed = JSON.parse(evt.data)
    if (ed.type === "message") {
      var chanData = data.getChannel(ed.object.network, ed.object.channel)
      if (chanData.isFetchingHistory()) {
        chanData.pushCache(ed.object)
      } else {
        receive(ed.object.id, ed.object.network, ed.object.channel, ed.object.timestamp,
          ed.object.sender, ed.object.command, ed.object.message, ed.object.ownmsg,
          ed.object.preview, true)
      }
    } else if (ed.type === "cmdresponse") {
      receiveCmdResponse(ed.object.message)
    } else if (ed.type === "chandata") {
      var channel = data.getChannel(ed.object.network, ed.object.name)
      channel.setTopicFull(ed.object.topic, ed.object.topicsetat, ed.object.topicsetby)
      channel.setUsers(ed.object.userlist)
      channel.setNotificationLevel("all")
      openChannel(ed.object.network, ed.object.name, false)

      if(getActiveNetwork() === ed.object.network && getActiveChannel() === ed.object.name) {
        $("#title").text(ed.object.topic)
        updateUserList()
      }
    } else if (ed.type === "nickchange") {
      dbg("Nick changed to", ed.object.nick, "on", ed.object.network)
      data.getNetwork(ed.object.network).setNick(ed.object.nick)
    } else if (ed.type === "netdata") {
      if ($("#net-%s", ed.object.name.toLowerCase()).length === 0) {
        openNetwork(ed.object.name)
        settings.scripts.update(ed.object.name, false)
      }
      data.getNetwork(ed.object.name).setNetData(ed.object)
      if(ed.object.connected) {
        $(sprintf("#switchnet-%s", ed.object.name)).removeClass("disconnected")
      } else {
        $(sprintf("#switchnet-%s", ed.object.name)).addClass("disconnected")
      }
    } else if (ed.type === "chanlist") {
      data.getNetwork(ed.object.network).setChannels(ed.object.list)
    } else if (ed.type === "clear") {
      getChannel(ed.object.network, ed.object.channel).empty()
    } else if (ed.type === "delete") {
      $(sprintf("#msgwrap-%s", ed.object)).remove()
    } else if (ed.type === "whois") {
      openWhoisModal(ed.object)
    } else if (ed.type === "invite") {
      openChannel(ed.object.network, ed.object.channel, false)
      getChannel(ed.object.network, ed.object.channel).loadTemplate($("#template-invite"), {
        sender: ed.object.sender,
        channel: ed.object.channel,
        accept: sprintf("acceptInvite('%s', '%s')", ed.object.network, ed.object.channel),
        ignore: sprintf("closeChannel('%s', '%s')", ed.object.network, ed.object.channel)
      }, {append: false, isFile: false, async: false})
      $(sprintf("#switchto-%s-%s", ed.object.network.toLowerCase(), channelFilter(ed.object.channel))).addClass("new-messages")
    } else if (ed.type === "raw") {
      $(sprintf("#raw-output-%s", ed.object.network)).append(sprintf("<div class='rawoutmsg'>%s</div>", ed.object.message))
    }
  }

  socket.onclose = function(evt) {
    "use strict"
    if (evt.wasClean) {
      return
    }
    if (connected) {
      connected = false

      $("#disconnected").removeClass("hidden")
    }
    if (!authfail) {
      timeout = setTimeout(reconnect, 20000)
    }
  }
}

function acceptInvite(network, channel) {
	"use strict"
  getChannel(network, channel).empty()

  var channelData = data.getChannel(network, channel)
  if (!channelData.isHistoryFetched()) {
    history(network, channel, 512)
  }

  sendMessage({
    type: "message",
    network: network,
    channel: channel,
    command: "join",
    message: "Joining"
  })
}

function tryReconnect() {
  "use strict"
  clearTimeout(timeout)
  $("#try-reconnect").attr("disabled", true)
  $("#try-reconnect").text("Reconnecting")
  timeout = setTimeout(function() {
    $("#try-reconnect").text("Reconnecting.")
    timeout = setTimeout(function() {
      $("#try-reconnect").text("Reconnecting..")
      timeout = setTimeout(function() {
        $("#try-reconnect").text("Reconnecting...")
        timeout = setTimeout(function() {
          $("#try-reconnect").text("Reconnecting....")
          timeout = setTimeout(function() {
            $("#try-reconnect").text("Reconnecting.....")
            timeout = setTimeout(function() {
              $("#try-reconnect").text("Timed out!")
              $("#try-reconnect").removeAttr("disabled")
              timeout = setTimeout(function() {
                $("#try-reconnect").text("Try to reconnect")
                timeout = null
              }, 2000)
            }, 1000)
          }, 1000)
        }, 1000)
      }, 1000)
    }, 1000)
  }, 1000)
  reconnect()
}

function reconnect() {
  "use strict"
  $.ajax({
    type: "GET",
    url: "/auth/check",
    success: function(data) {
      if (data === "true") {
        connect()
      } else {
        authfail = true
        $("#container").loadTemplate($("#template-login"), {})
        msgcontainer = false
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      if(jqXHR.status === 401) {
        authfail = true
        $("#container").loadTemplate($("#template-login"), {})
        msgcontainer = false
      } else {
        timeout = setTimeout(reconnect, 20000)
      }
    }
  })
}

function history(network, channel, n) {
  var children = getChannel(network, channel).children(".message-wrapper")
  data.getChannel(network, channel).setFetchingHistory(true)
  "use strict"
  $.ajax({
    type: "GET",
    url: sprintf("/history/%s/%s/?n=%d", network, encodeURIComponent(channel), n),
    dataType: "json",
    success: function(histData) {
      "use strict"
      if (isEmpty(histData)) {
        return
      }
      children.remove()
      histData.reverse().forEach(function(val, i, arr) {
        receive(val.id, val.network, val.channel, val.timestamp, val.sender, val.command, val.message, val.ownmsg, val.preview, false)
      })
      var chanData = data.getChannel(network, channel)
      var msg = chanData.shiftCache()
      while (!isEmpty(msg)) {
        receive(msg.id, msg.network, msg.channel, msg.timestamp, msg.sender, msg.command, msg.message, msg.ownmsg, msg.preview, true)
        var msg = chanData.shiftCache()
      }
      chanData.setFetchingHistory(false)
      chanData.setHistoryFetched()
      scrollDown()
    },
    error: function(jqXHR, textStatus, errorThrown) {
      "use strict"
      data.getChannel(network, channel).setFetchingHistory(false)
      dbg(jqXHR)
      if(getActiveNetwork().length === 0 || getActiveChannel().length === 0) {
        return
      }
      getChannel(getActiveNetwork(), getActiveChannel()).loadTemplate($(sprintf("#template-error")), {
        message: sprintf("Failed to fetch history: %s %s", channel, network, textStatus, errorThrown)
      }, {isFile: false, async: false, append: true})
      scrollDown()
    }
  })
}