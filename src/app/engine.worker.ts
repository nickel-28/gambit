/// <reference lib="webworker" />
import { best } from './engine';
addEventListener('message', ({ data }) => postMessage({ id: data.id, m: best(data.s, data.d, data.t) }));