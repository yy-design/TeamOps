import { EventEmitter } from 'node:events';

const events = new EventEmitter();
events.setMaxListeners(200);

export function publishNotificationEvent(userId: string) {
  events.emit(userId);
}

export function subscribeToNotificationEvents(userId: string, listener: () => void) {
  events.on(userId, listener);
  return () => events.off(userId, listener);
}
