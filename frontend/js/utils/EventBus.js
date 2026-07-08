const _listeners = {};

export const EventBus = {
  on(event, fn) {
    (_listeners[event] ??= []).push(fn);
  },
  off(event, fn) {
    _listeners[event] = _listeners[event]?.filter(f => f !== fn);
  },
  emit(event, data) {
    _listeners[event]?.forEach(fn => fn(data));
  },
  once(event, fn) {
    const wrap = (d) => {
      fn(d);
      this.off(event, wrap);
    };
    this.on(event, wrap);
  },
};
