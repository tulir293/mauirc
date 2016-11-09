// mauIRC - The original mauIRC web frontend
// Copyright (C) 2016 Tulir Asokan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
"use strict"

class EventSystem {
	constructor(mauirc) {
		this.mauirc = mauirc
		this.handlers = {}
		this.activate()
	}

	click(evt, func) {
		this.on(evt + ":click", func)
	}

	submit(evt, func) {
		this.on(evt + ":submit", func)
	}

	on(evt, func) {
		if (!this.handlers.hasOwnProperty(evt)) {
			this.handlers[evt] = []
		}
		this.handlers[evt].push(func)
	}

	exec(evt, source, obj) {
		if (!this.handlers.hasOwnProperty(evt)) {
			return
		}

		source.stopPropagation()

		for (let func of this.handlers[evt]) {
			func(obj, source)
		}
	}

	activate() {
		let evsys = this
		this.mauirc.container.on("click", "*[data-event]", function(event) {
			let evt = this.getAttribute("data-event") + ":click"
			evsys.exec(evt, event, this)
		})
		this.mauirc.container.on("submit", "*[data-event][data-event-type='submit']", function(event) {
			let evt = this.getAttribute("data-event") + ":submit"
			evsys.exec(evt, event, this)
		})
	}
}
