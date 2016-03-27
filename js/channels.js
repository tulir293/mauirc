function getActiveChannel() {
  var active = $(".channel-switcher.active > .channel-switcher-name")
  if (active.length) {
    return active.text()
  }
  return ""
}

function getActiveNetwork() {
  var active = $(".network-switcher.activenet > .network-switcher-name")
  if (active.length) {
    return active.text().trim()
  }
  return ""
}

function getActiveChannelObj() {
  return $(".channel-container:not(.hidden)")
}

function getActiveNetworkObj(){
  return $(".network-container:not(.hidden)")
}

function openNetwork(network) {
  network = network.toLowerCase()
  $("#messages").loadTemplate($("#template-network"), {
    network: "net-" + network
  }, {append: true, isFile: false, async: false})
  $("#networks").loadTemplate($("#template-network-switcher"), {
    network: "switchnet-" + network,
    networkname: network,
    networkbtns: "chanswitchers-" + network
  }, {append: true, isFile: false, async: false})
}

function openChannel(network, channel) {
  var netObj = $("#net-" + network)
  if (netObj.length == 0) {
    openNetwork(network)
    netObj = $("#net-" + network)
  }

  network = network.toLowerCase()
  netObj.loadTemplate($("#template-channel"), {
    channel: "chan-" + channel.toLowerCase()
  }, {append: true, isFile: false, async: false})
  $("#chanswitchers-" + network).loadTemplate($("#template-channel-switcher"), {
    channel: "switchto-" + channel.toLowerCase(),
    channelname: channel,
    onclick: "switchTo('" + network + "', '" + channel.toLowerCase() + "')"
  }, {append: true, isFile: false, async: false})
}

function switchView() {
  if ($("#networks").hasClass("hidden-tablet-down")) {
    $("#messaging").addClass("hidden-tablet-down")
    $("#networks").removeClass("hidden-tablet-down")
  } else {
    $("#messaging").removeClass("hidden-tablet-down")
    $("#networks").addClass("hidden-tablet-down")
  }
}

function switchTo(network, channel) {
  network = network.toLowerCase()
  console.log("Switching to channel " + channel + " @ " + network)
  getActiveChannelObj().addClass("hidden")
  getActiveNetworkObj().addClass("hidden")
  $(".channel-switcher.active").removeClass("active")
  $(".network-switcher.activenet").removeClass("activenet")
  $("#message-text").focus()

  var title = channel
  if (channelData[network] !== undefined &&
    channelData[network][channel] !== undefined &&
    channelData[network][channel].topic !== undefined &&
    channelData[network][channel].topic.length > 0) {
    title = channelData[network][channel].topic
  }
  $("#title").text(title)

  if ($("#messaging").hasClass("hidden-tablet-down")) {
    switchView()
  }

  if (channel == "MauIRC Status") {
    $("#status-messages").removeClass("hidden")
    $("#status-enter").addClass("active")
    $("#status-enter").removeClass("new-messages")
    scrollDown()
    return
  }

  $("#switchnet-" + network).addClass("activenet")
  var netObj = $("#net-" + network)
  var chanObj = netObj.find("#chan-" + channelFilter(channel))
  netObj.removeClass("hidden")
  chanObj.removeClass("hidden")

  var newChanSwitcher = $("#switchto-" + channelFilter(channel))
  newChanSwitcher.removeClass("new-messages")
  newChanSwitcher.addClass("active")

  scrollDown()
}

function channelFilter(channel) {
  return channel.replace("#", "\\#").toLowerCase()
}
