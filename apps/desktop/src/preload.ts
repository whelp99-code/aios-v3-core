import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  app: {
    name: 'AIOS',
    version: '0.1.0',
  },
});
