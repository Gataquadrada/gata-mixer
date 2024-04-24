import { app, shell, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { readFileSync, writeFileSync } from 'fs'
import { SerialPort } from 'serialport'
import voicemeeter from 'voicemeeter-remote'
import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer'

// Log
function log(message) {
  try {
    const date = new Date()
    writeFileSync(
      join(app.getPath('logs'), `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}.txt`),
      `[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] ` + message + '\n',
      { flag: 'a' }
    )
  } catch (err) {}
}

log('Starting...')

// Tray
var tray

// Load config
const configDefaults = {
  window_width: 1050,
  window_height: 625,
  win_start: false,
  win_start_minimized: false,
  arduino_port: false,
  arduino_port_other: 'COM1',
  vm_volume_display: 'db',
  vm_volume_min: -60,
  vm_volume_max: 0,
  my_strips: []
}

global.appConfig = {}

try {
  const savedConfig = JSON.parse(
    readFileSync(join(app.getPath('userData'), 'config.json')).toString()
  )
  global.appConfig = { ...configDefaults, ...savedConfig }
} catch (err) {
  global.appConfig = { ...configDefaults, ...global.appConfig }
}

function appSettingsSave(settings) {
  global.appConfig = { ...configDefaults, ...global.appConfig, ...settings }

  writeFileSync(
    join(app.getPath('userData'), 'config.json'),
    JSON.stringify(global.appConfig, null, 4)
  )

  try {
    if (!is.dev) {
      if (global.appConfig?.win_start) {
        app.setLoginItemSettings({
          openAtLogin: true,
          enabled: true
        })
      } else {
        app.setLoginItemSettings({
          openAtLogin: true,
          enabled: false
        })
      }
    }
  } catch (err) {
    log(err?.message ?? err)
  }

  return global.appConfig
}

// (Try to) connect to Arduino

var inoReconnectTimer
var inoConnection
var inoOutputLast = 'Loading...'
/**
 * Description
 * @param {?string|?int} port=null
 * @param {boolean} reconnect=false
 * @param {boolean} justCheck=false
 * @returns {Promise<boolean>}
 */
async function connectArduino(
  { port = null, reconnect = false, justCheck = false } = {
    port: null,
    reconnect: false,
    justCheck: false
  }
) {
  closeArduino()

  return new Promise((resolve, reject) => {
    try {
      inoConnection = new SerialPort({
        path: port?.toString() ?? global.appConfig?.arduino_port?.toString() ?? 'COM1',
        baudRate: 9600
      })

      inoConnection.on('open', () => {
        log('Port opened', port)

        clearTimeout(inoReconnectTimer)

        try {
          mainWindow.webContents.send('ino:online', null)
        } catch (err) {
          // log(err?.message ?? err)
        }

        try {
          tray.setImage(join(__dirname, '..', '..', 'resources', 'icon.png'))
        } catch (err) {}

        if (justCheck) {
          inoConnection.close()
          resolve(true)
        } else {
          inoOutputLast = 'LOADING...'
          inoSend(inoOutputLast)
          resolve(true)
        }
      })

      // Open errors will be emitted as an error event
      inoConnection.on('error', function (err) {
        log('Port Error')
        log(err?.message ?? err)

        try {
          mainWindow.webContents.send('ino:offline', null)
        } catch (err) {
          // log(err?.message ?? err)
        }

        try {
          tray.setImage(join(__dirname, '..', '..', 'resources', 'icon-error.png'))
        } catch (err) {}

        if (reconnect) {
          connectArduino()
        }

        reject(err)
      })

      // Read data that is available but keep the stream in "paused mode"
      inoConnection.on('readable', function () {
        // log("Data:", port.read())
        inoConnection.read()
      })

      // Switches the port into "flowing mode"
      inoConnection.on('data', function (data) {
        clearTimeout(inoReconnectTimer)

        if (reconnect) {
          inoReconnectTimer = setTimeout(() => {
            connectArduino()
          }, 5000)
        }

        const text = data.toString()?.trim()

        if (text) {
          try {
            mainWindow.webContents.send('ino:output', text)
          } catch (err) {
            // log(err?.message ?? err)
          }

          try {
            // log(text)

            const values = text.split('|')

            let inoOutput = []

            if (values[0] === 'ON') {
              inoOutput.push('SW: (ON)')
            } else {
              inoOutput.push('SW: [OFF]')
            }

            global.appConfig.my_strips.map((strip, i) => {
              if (strip?.microphone) {
                if ('vm' == strip?.type) {
                  if (values[0] === 'ON') {
                    setVoiceMeeterParam(`Strip[${strip?.index ?? 1}].Mute`, 0)
                  } else {
                    setVoiceMeeterParam(`Strip[${strip?.index ?? 1}].Mute`, 1)
                  }
                } else {
                  if ('_main' == strip?.win_target_type) {
                    if (values[0] === 'ON') {
                      NodeAudioVolumeMixer.muteMaster(false)
                    } else {
                      NodeAudioVolumeMixer.muteMaster(true)
                    }
                  } else if (strip?.win_target) {
                    const winTarget = strip?.win_target?.split('|') ?? []

                    // Get an audio session.
                    const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses()

                    // Find the session by PID.
                    const session = sessions.find((value) => {
                      return value.pid == winTarget[1]
                    })

                    if (session) {
                      if (values[0] === 'ON') {
                        NodeAudioVolumeMixer.setAudioSessionMute(session.pid, false)
                      } else {
                        NodeAudioVolumeMixer.setAudioSessionMute(session.pid, true)
                      }
                    } else {
                      // Find the session by Name.
                      const session = sessions.find((value) => {
                        return value.name == winTarget[0]
                      })

                      if (session) {
                        if (values[0] === 'ON') {
                          NodeAudioVolumeMixer.setAudioSessionMute(session.pid, false)
                        } else {
                          NodeAudioVolumeMixer.setAudioSessionMute(session.pid, true)
                        }
                      }
                    }
                  }
                }
              }

              const volume = parseInt(values[i + 1])

              const minVolume = global.appConfig?.vm_volume_min ?? -60
              const maxVolume = strip?.loud ? 12 : global.appConfig?.vm_volume_max ?? 0
              const minKnob = strip?.vm_strip_min ?? global.appConfig?.vm_strip_min ?? 0
              const maxKnob = strip?.vm_strip_max ?? global.appConfig?.vm_strip_max ?? 1023

              const volumeGain = parseInt(
                ((volume - minKnob) / (maxKnob - minKnob)) * (maxVolume - minVolume) + minVolume
              )

              const volumePercentage = Math.round(
                ((volumeGain - minVolume) * 100) / (maxVolume - minVolume)
              )

              if ('vm' == strip?.type) {
                setVoiceMeeterParam(`Strip[${strip?.index ?? 1}].Gain`, volumeGain)

                inoOutput.push(
                  `S${strip?.index + 1 ?? 1}: ${'db' == global.appConfig.vm_volume_display ? `${volumeGain}dB` : `${volumePercentage}%`}`
                )
              } else {
                if ('_main' == strip?.win_target_type) {
                  NodeAudioVolumeMixer.setMasterVolumeLevelScalar(volumePercentage / 100)

                  inoOutput.push(`WM: ${volumePercentage}%`)
                } else if (strip?.win_target) {
                  const winTarget = strip?.win_target?.split('|') ?? []

                  // Get a audio session.
                  const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses()

                  // Find the session by PID.
                  const session = sessions.find((value) => {
                    return value.pid == winTarget[1]
                  })

                  if (session) {
                    NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(
                      session.pid,
                      volumePercentage / 100
                    )
                  } else {
                    // Find the session by Name.
                    const session = sessions.find((value) => {
                      return value.name == winTarget[0]
                    })

                    if (session) {
                      NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(
                        session.pid,
                        volumePercentage / 100
                      )
                    }
                  }

                  inoOutput.push(`W${winTarget[0].substring(0, 1)}: ${volumePercentage}%`)
                }
              }
            })

            inoOutput = inoOutput.slice(0, 7).join('|')

            // This is to avoid sending the same data multiple times and overloading the LCD screen (they break *very* easily)
            if (inoOutput !== inoOutputLast) {
              inoSend(inoOutput)
              inoOutputLast = inoOutput
            }
          } catch (err) {
            log(err?.message ?? err)
          }
        }
      })

      clearTimeout(inoReconnectTimer)

      if (reconnect) {
        inoReconnectTimer = setTimeout(() => {
          connectArduino()
        }, 10000)
      }
    } catch (err) {
      log('Error connecting to Arduino. Please check the port and try again.')
      log(err?.message ?? err)

      reject(err)
    }
  })
}

async function closeArduino() {
  try {
    if (inoConnection?.isOpen) {
      inoConnection.close()
    }
  } catch (err) {
    log('No Ino connection to close.')
  }
}

/**
 * Sends (text) data to Arduino
 * @param {string} message
 * @returns {void}
 */
function inoSend(message) {
  try {
    inoConnection.write(message)
  } catch (err) {
    log('Error sending message to Arduino.')
    log(err?.message ?? err)
  }
}

/**
 * Connecting to VM
 * @returns {Promise<boolean>}
 */
async function connectVoiceMeeter(
  { reconnect = false } = {
    reconnect: false
  }
) {
  return new Promise(async (resolve, reject) => {
    try {
      await voicemeeter.init()

      log('Connected to VoiceMeeter.')

      voicemeeter.login()

      voicemeeter.updateDeviceList()

      // Get input devices
      // log(voicemeeter.inputDevices)
      // Get output devices
      // log(voicemeeter.outputDevices)

      resolve(true)
    } catch (err) {
      if (err.includes('connected')) resolve(true)

      log('Error connecting to VoiceMeeter:')
      log(err?.message ?? err)

      reject(false)
    }
  })
}

/**
 * Returns VM's parameter value
 * There's no way to know if VM is connected or not, so it's best to call connectVoiceMeeter() before this.
 * @param {string} param='Strip[0].Gain'
 * @returns {?float}
 */
function getVoiceMeeterParam(param = 'Strip[0].Gain') {
  connectVoiceMeeter().then(() => {
    try {
      voicemeeter.getRawParameterFloat(param, 0)
    } catch (err) {
      log(err?.message ?? err)
    }
  })
}

/**
 * Sets VM's parameter value.
 * There's no way to know if VM is connected or not, so it's best to call connectVoiceMeeter() before this.
 * @param {string} param='Strip[0].Gain'
 * @param {float} value=0
 * @returns {?float}
 */
function setVoiceMeeterParam(param = 'Strip[0].Gain', value = 0) {
  connectVoiceMeeter().then(() => {
    try {
      voicemeeter.setRawParameterFloat(param, value)
    } catch (err) {
      log(err?.message ?? err)
    }
  })
}

// IPC test
ipcMain.on('ping', () => log('pong'))

// Send settings to webview
ipcMain.handle('settings:get', () => {
  return global.appConfig
})

// Save settings
ipcMain.handle('settings:set', (_, settings) => {
  return appSettingsSave(settings)
})

// List Ports
ipcMain.handle('ino:listPorts', () => {
  return SerialPort.list()
})

// Test Port
ipcMain.handle('ino:testPort', async (_, port) => {
  return await connectArduino({ port, justCheck: true })
})

// Ino Connect
ipcMain.handle('ino:connect', async (_, port) => {
  return await connectArduino({ port, reconnect: true })
})

// Ino Close
ipcMain.handle('ino:close', async () => {
  return await closeArduino()
})

// Start VoiceMeeter
ipcMain.handle('vm:start', async () => {
  return await connectVoiceMeeter({ reconnect: true })
})

// Get VoiceMeeter Param
ipcMain.handle('vm:getParam', async (_, param = 'Strip[0].Gain') => {
  return await getVoiceMeeterParam(param)
})

// Set VoiceMeeter Param
ipcMain.handle('vm:setParam', async (_, param = 'Strip[0].Gain', value = 0) => {
  return await setVoiceMeeterParam(param, value)
})

// Get Windows Apps that have a sound session available
ipcMain.handle('win:appsList', async () => {
  return NodeAudioVolumeMixer.getAudioSessionProcesses()
})

// Get the App Version
ipcMain.handle('app:version', async () => {
  return app?.getVersion() ?? '???'
})

// Get the App CWD
ipcMain.handle('app:path', async () => {
  return app?.getPath('userData') ?? process?.cwd() ?? ''
})

// Electron window
var mainWindow
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: global.appConfig?.window_width ?? 900,
    height: global.appConfig?.window_height ?? 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false // Important for being able to run backend VM and Ino scripts
    }
  })

  mainWindow.on('resized', () => {
    const size = mainWindow.getSize()

    appSettingsSave({
      window_width: size[0],
      window_height: size[1]
    })
  })

  mainWindow.on('ready-to-show', () => {
    try {
      if (global.appConfig?.win_start_minimized) return null
      mainWindow.show()
    } catch (err) {
      log(err?.message ?? err)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  tray = new Tray(join(__dirname, '..', '..', 'resources', 'icon.png'))
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        try {
          mainWindow.show()
        } catch (err) {
          createWindow()
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.on('double-click', () => {
    try {
      mainWindow.show()
    } catch (err) {
      createWindow()
    }
  })

  tray.setContextMenu(contextMenu)

  tray.setToolTip('Gata Mixer')
  tray.setTitle('Gata Mixer')

  // Set app user model id for windows
  electronApp.setAppUserModelId('dev.gata.mixer')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
