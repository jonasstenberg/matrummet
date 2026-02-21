/// <reference types="vite/client" />
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

export default createStartHandler(defaultStreamHandler)
