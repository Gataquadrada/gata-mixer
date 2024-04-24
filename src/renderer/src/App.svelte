<script>
  import './app.postcss'

  import { onMount } from 'svelte'

  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom'

  import { storePopup } from '@skeletonlabs/skeleton'
  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow })

  import { AppShell, TabGroup, Tab, popup, ListBox, ListBoxItem } from '@skeletonlabs/skeleton'

  import {
    ThreeDotsVertical,
    Square,
    CheckSquare,
    BoomboxFill,
    LifePreserver,
    UsbSymbol
  } from 'svelte-bootstrap-icons'

  import ViewMixer from './views/Mixer.svelte'
  import ViewSettings from './views/Help.svelte'

  let appVersion = ''

  let tabGroup = 'mixer'
  let settings = {}
  let portChecking = 'COM(0)...?'
  let inoConnected = false
  let inoPorts = []
  let stVolumeDisplay = '%'
  let stPort = settings?.arduino_port ?? false
  let stPortOther = settings?.arduino_port_other ?? ''

  const init = async () => {
    appVersion = await api.version()

    settings = await api.getSettings()

    inoPorts = await api.inoListPorts()

    stPort = settings?.arduino_port ?? false
    stPortOther = settings?.arduino_port_other ?? ''
    stVolumeDisplay = settings?.vm_volume_display ?? '%'

    // Check Arduino
    if (!stPort) {
      for (const port of inoPorts) {
        portChecking = port.path

        const portExists = await api.inoTestPort(port.path)

        if (portExists) {
          api.inoClose()
          settings.arduino_port = stPort = port.path
          await api.setSettings({ arduino_port: stPort })
          await api.inoConnect('_other' == stPort ? stPortOther : stPort)
          break
        }
      }
    } else {
      await api.inoConnect('_other' == stPort ? stPortOther : stPort)
    }
  }

  api.onInoOffline(() => {
    inoConnected = false
  })

  api.onInoOnline(() => {
    inoConnected = true
  })

  // Skip Autodetect
  const skipWizard = async () => {
    settings.arduino_port = stPort = '_other'
    await api.setSettings({ arduino_port: stPort })
  }

  onMount(() => {
    init()
  })
</script>

{#if stPort === false}
  <div class="h-full w-full flex flex-col items-center justify-center gap-4">
    <div class="flex gap-4">
      <div class="flex items-center justify-center aspect-square border-animated p-4 h-[100px]">
        {portChecking}...?
      </div>
    </div>

    <div>
      <button
        class="btn variant-soft border border-gray-300"
        on:click={() => {
          skipWizard()
        }}>Skip Arduino check</button
      >
    </div>
  </div>
{:else}
  <AppShell>
    <svelte:fragment slot="header">
      <TabGroup justify="justify-center" class="pt-4">
        <Tab bind:group={tabGroup} name="tab1" value={'mixer'}>
          <svelte:fragment slot="lead">
            <div class="flex justify-center">
              <BoomboxFill />
            </div>
          </svelte:fragment>
          <span>Mixer</span>
        </Tab>

        <Tab bind:group={tabGroup} name="tab2" value={'settings'}>
          <svelte:fragment slot="lead">
            <div class="flex justify-center">
              <LifePreserver />
            </div>
          </svelte:fragment>
          <span>Help</span>
        </Tab>

        <div class="ms-auto flex items-center gap-2 p-4 -mt-4">
          <!-- Volume Display -->
          <select
            class="select min-w-[70px]"
            bind:value={stVolumeDisplay}
            on:change={() => {
              settings.vm_volume_display = stVolumeDisplay
              api.setSettings({ vm_volume_display: stVolumeDisplay })
            }}
          >
            <option value="%">%</option>
            <option value="db">dB</option>
          </select>

          <!-- Arduino Port -->
          <select
            class="select min-w-[100px]"
            bind:value={stPort}
            on:change={() => {
              api.inoConnect('_other' == stPort ? stPortOther : stPort)
              api.setSettings({ arduino_port: stPort })
            }}
          >
            {#each inoPorts as { path }}
              <option value={path}>{path}</option>
            {/each}
            <hr />
            <option value="_other">Other</option>
          </select>

          {#if '_other' == stPort}
            <input
              class="input min-w-[100px]"
              placeholder="Port"
              bind:value={stPortOther}
              on:input={() => {
                api.inoConnect('_other' == stPort ? stPortOther : stPort)
                api.setSettings({ arduino_port_other: stPortOther })
              }}
            />
          {/if}

          <!-- Arduino reconnect button -->
          {#if !inoConnected}
            <button
              class="btn btn-lg variant-ringed !bg-surface-700 px-4 text-rose-500"
              on:click={async () => {
                inoPorts = await api.inoListPorts()
                api.inoConnect('_other' == stPort ? stPortOther : stPort)
              }}
            >
              <UsbSymbol />
            </button>
          {/if}

          <!-- Menu -->
          <button
            class="btn btn-lg variant-ringed !bg-surface-700 px-2"
            use:popup={{
              event: 'click',
              target: 'popupMainMenu',
              placement: 'bottom',
              closeQuery: '.listbox-item'
            }}
          >
            <ThreeDotsVertical />
          </button>
          <!-- Menu Popup -->
          <div class="card p-1 variant-filled-surface !bg-surface-700" data-popup="popupMainMenu">
            <ListBox rounded="rounded-none variant-filled-surface !bg-surface-700">
              <!-- Reconnect INO -->
              <ListBoxItem class="!bg-surface-700">
                <div
                  class="flex items-center gap-2"
                  on:click={async () => {
                    inoPorts = await api.inoListPorts()
                    api.inoConnect('_other' == stPort ? stPortOther : stPort)
                  }}
                >
                  <span>Reconnect Arduino</span>
                </div>
              </ListBoxItem>

              <!-- Reconnect INO -->
              <!-- <ListBoxItem class="!bg-surface-700">
                <div
                  class="flex items-center gap-2"
                  on:click={() => {
                    api.vmStart()
                  }}
                >
                  <span>Reconnect VoiceMeeter</span>
                </div>
              </ListBoxItem> -->

              <!-- Start with Windows -->
              <ListBoxItem class="!bg-surface-700">
                <div
                  class="flex items-center gap-2"
                  on:click|preventDefault={() => {
                    settings.win_start = !settings.win_start
                    api.setSettings({ win_start: settings.win_start })
                  }}
                >
                  {#if settings.win_start}
                    <CheckSquare />
                  {:else}
                    <Square />
                  {/if}
                  <span>Start with Windows</span>
                </div>
              </ListBoxItem>

              <!-- Start Minimized -->
              <ListBoxItem class="!bg-surface-700">
                <div
                  class="flex items-center gap-2"
                  on:click|preventDefault={() => {
                    settings.win_start_minimized = !settings.win_start_minimized
                    api.setSettings({ win_start_minimized: settings.win_start_minimized })
                  }}
                >
                  {#if settings.win_start_minimized}
                    <CheckSquare />
                  {:else}
                    <Square />
                  {/if}
                  <span>Run minimized</span>
                </div>
              </ListBoxItem>
            </ListBox>

            <div class="arrow variant-filled-surface !bg-surface-700" />
          </div>
        </div>
      </TabGroup>
    </svelte:fragment>

    <!-- Router Slot -->
    <div class="px-4 py-5 h-full">
      {#if 'mixer' === tabGroup}
        <ViewMixer bind:settings />
      {:else if 'settings' === tabGroup}
        <ViewSettings />
      {/if}
    </div>
    <!-- ---- / ---- -->

    <!-- (pageFooter) -->
    <svelte:fragment slot="footer">
      <div class="p-1 text-xs text-center bg-black/20">
        Gata Mixer {appVersion}
      </div>
    </svelte:fragment>
  </AppShell>
{/if}

<style>
  #page {
    @apply h-full overflow-hidden;
  }

  .border-animated {
    @apply border-2 border-solid;

    animation: borderColor 5s ease-out infinite both;
  }

  @keyframes borderColor {
    0% {
      border-color: cyan;
    }
    20% {
      border-color: #9b59b6;
    }
    40% {
      border-color: #3498db;
    }
    60% {
      border-color: #37d077;
    }
    80% {
      border-color: #e67e22;
    }
    100% {
      border-color: #1cc6a4;
    }
  }
</style>
