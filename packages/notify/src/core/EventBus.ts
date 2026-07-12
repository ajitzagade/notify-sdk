import EventEmitter from 'eventemitter3';
import { NotifyEvent, InboundReply } from '../types';

export type NotifyEventName =
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'read'
  | 'reply'
  | 'queued';

export class EventBus {
  private emitter = new EventEmitter();

  emit(event: NotifyEventName, payload: NotifyEvent | InboundReply, error?: Error): void {
    this.emitter.emit(event, payload, error);
  }

  on(event: NotifyEventName, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: NotifyEventName, handler: (...args: unknown[]) => void): void {
    this.emitter.off(event, handler);
  }
}
