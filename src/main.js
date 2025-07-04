import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import UpdateActions from './actions.js'
import UpdateFeedbacks from './feedbacks.js'
import UpdatePresets from './presets.js'
import UpdateVariableDefinitions from './variables.js'
import UpdateVariableValues from './updatevariables.js'
import * as blink from './blink.js'
import * as config from './config.js'
import * as device from './device.js'
import * as digital6000 from './digital6000.js'
import * as parseResponse from './parseResponse.js'
import * as queue from './queue.js'
import * as subscriptions from './subscriptions.js'
import * as udp from './udp.js'
import { throttle } from 'lodash'

const THROTTLE_RATE = 40

class Digital6000 extends InstanceBase {
	constructor(internal) {
		super(internal)
		Object.assign(this, {
			...blink,
			...config,
			...device,
			...digital6000,
			...parseResponse,
			...queue,
			...subscriptions,
			...udp,
		})
		this.frame = 0
		this.feedbacksToUpdate = new Set()
	}

	async init(config) {
		this.config = config
		this.currentStatus = {
			status: 'unknown',
			label: '',
		}
		this.configUpdated(config)
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', `destroy ${this.id}`)
		this.stopCmdQueue()
		this.stopFeedbackChecks()
		this.stopBlink()
		this.stopFrame()
		await this.cancelSubscriptions(this.config.device)
		if (this.socket) {
			this.socket.destroy()
			delete this.socket
		}
	}

	async configUpdated(config) {
		this.config = config
		process.title = this.label
		this.stopFeedbackChecks()
		this.config.host = config.bonjour_host?.split(':')[0] || config.host
		this.config.port = config.bonjour_host?.split(':')[1] || config.port
		await this.cancelSubscriptions(this.config.device)
		this.statusCheck(InstanceStatus.Connecting, '')
		this.initDigital6000(this.config.device)
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export presets
		this.updateVariableDefinitions() // export variable definitions
		this.init_udp(this.config.host, this.config.port)
	}

	throttledVariableUpdates = throttle(
		() => {
			this.updateVariableValues()
		},
		THROTTLE_RATE,
		{ leading: false, trailing: true },
	)

	throttledFeedbackChecks = throttle(
		() => {
			this.checkFeedbacks(...this.feedbacksToUpdate)
			this.feedbacksToUpdate.clear()
		},
		THROTTLE_RATE,
		{ leading: false, trailing: true },
	)

	addFeedbacksToQueue(...feedbacks) {
		for (const fback of feedbacks) {
			this.feedbacksToUpdate.add(fback)
		}
		this.throttledFeedbackChecks()
		this.throttledVariableUpdates()
	}

	statusCheck(newStatus, newLabel) {
		if (this.currentStatus.status === newStatus && this.currentStatus.label === newLabel) {
			return
		}
		this.updateStatus(newStatus, newLabel)
		this.currentStatus.status = newStatus
		this.currentStatus.label = newLabel
	}

	stopFeedbackChecks() {
		this.feedbacksToUpdate.clear()
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updatePresets() {
		UpdatePresets(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
	updateVariableValues() {
		UpdateVariableValues(this)
	}
}

runEntrypoint(Digital6000, UpgradeScripts)
