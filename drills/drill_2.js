const EventEmitter = require('events');

class NotificationSystem extends EventEmitter {
  constructor() {
    super();
    this._listeners = new Map();
  }

  on(event, fn) {
    super.on(event, fn);
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(fn);
    return this;
  }

  notify(event, data) {
    console.log(`[EVENT] ${event}`, data);
    this.emit(event, data);
  }

  listenerCount(event) {
    return (this._listeners.get(event) || []).length;
  }
}

// Demo
const notifier = new NotificationSystem();

notifier.on('user:created', ({ id, name }) => {
  console.log(`  → Email service: welcome email to ${name} (#${id})`);
});

notifier.on('user:created', ({ name }) => {
  console.log(`  → Analytics: track signup for ${name}`);
});

notifier.on('user:deleted', ({ id }) => {
  console.log(`  → Cleanup: removed user #${id} data`);
});

// Simulate events
const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

for (const user of users) {
  notifier.notify('user:created', user);
}

notifier.notify('user:deleted', { id: 2 });

console.log(`\nListeners per event:`);
for (const [event, fns] of notifier._listeners) {
  console.log(`  ${event}: ${fns.length} listener(s)`);
}
