declare global {
  var pageYOffset: number;
  var scrollTo: (options: {top: number}) => void;

  // var setTimeout: (callback: () => void, delay: number) => number;
  // var clearTimeout: (id: number) => void;
  // var setInterval: (callback: () => void, delay: number) => number;
  // var clearInterval: (id: number) => void;
  var requestAnimationFrame: (callback: () => void) => number;
  var cancelAnimationFrame: (id: number) => void;
  var innerHeight: number;
  var document: any;
  var history: any;
}

declare module 'babel-plugin-react-compiler';

export {};
