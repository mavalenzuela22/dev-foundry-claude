declare module 'history' {
  export function createMemoryHistory(): import('@epam/uui-core').IHistory4;
  export function createBrowserHistory(): import('@epam/uui-core').IHistory4;
}
