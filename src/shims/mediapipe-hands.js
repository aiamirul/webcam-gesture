export class Hands {
  constructor() {}
  setOptions() {}
  onResults() {}
  send() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  initialize() { return Promise.resolve(); }
  reset() {}
}

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export const Solution = class {};
export const OptionType = {};
export const VERSION = '0.4.1675469240';

export default {
  Hands,
  HAND_CONNECTIONS,
  Solution,
  OptionType,
  VERSION,
};
