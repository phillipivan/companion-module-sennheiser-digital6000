import PQueue from 'p-queue'
const msg_delay = 5
const queue = new PQueue({ concurrency: 1, interval: msg_delay, intervalCap: 1 })

export async function addCmdtoQueue(cmd, priority = 1) {
	if (cmd !== undefined && cmd instanceof Object) {
		if (priority > 0 || queue.size < 20) {
			return await queue.add(
				async () => {
					return await this.sendCommand(cmd)
				},
				{ priority: priority },
			)
		}
	}
	this.log('warn', `Invalid command: ${cmd}`)
	return false
}

export function startCmdQueue() {
	queue.clear()
	queue.start()
}

export function stopCmdQueue() {
	queue.clear()
	queue.pause()
}
