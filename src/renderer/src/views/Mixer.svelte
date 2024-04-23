<script>
  import { onMount, onDestroy } from 'svelte'

  import { popup } from '@skeletonlabs/skeleton'

  import { Windows, Plus, Mic, MicFill, VolumeDown, VolumeUp, XLg } from 'svelte-bootstrap-icons'

  export let settings = {}

  let vmStrips = []
  let winApps = []
  let micOn = false

  async function reloadWinApps() {
    winApps = await api.winAppsList()

    winApps = winApps.filter((app) => app.name)
  }

  async function addStrip() {
    vmStrips = [
      ...vmStrips,
      {
        type: 'vm',
        index: 0,
        volume: 0,
        microphone: false,
        loud: false,
        win_target_type: '_main',
        win_target: ''
      }
    ]
  }

  async function saveSettings() {
    await api.setSettings({
      my_strips: vmStrips.map((strip) => {
        return {
          type: strip.type,
          index: strip.index,
          microphone: strip.microphone,
          loud: strip.loud,
          win_target_type: strip?.win_target_type ?? false,
          win_target: strip?.win_target ?? false
        }
      })
    })
  }

  async function inoMessageHandler(value) {
    const values = value.split('|')

    micOn = values[0] === 'ON'

    vmStrips = vmStrips.map((strip, i) => {
      const volume = parseInt(values[i + 1] ?? 0)

      const minVolume = settings?.vm_volume_min ?? -60
      const maxVolume = strip?.loud ? 12 : settings?.vm_volume_max ?? 0
      const minKnob = strip?.vm_strip_min ?? settings?.vm_strip_min ?? 0
      const maxKnob = strip?.vm_strip_max ?? settings?.vm_strip_max ?? 1023

      const volumeGain = parseInt(
        ((volume - minKnob) / (maxKnob - minKnob)) * (maxVolume - minVolume) + minVolume
      )

      const volumePercentage = Math.round(
        ((volumeGain - minVolume) * 100) / (maxVolume - minVolume)
      )

      strip.volumePercentage = volumePercentage
      strip.volume =
        'vm' == strip?.type && 'db' == settings.vm_volume_display
          ? `${volumeGain}dB`
          : `${volumePercentage}%`

      return strip
    })
  }

  let timer
  onMount(async () => {
    await reloadWinApps()

    timer = setInterval(async () => {
      await reloadWinApps()
    }, 5000)

    settings = await api.getSettings()

    if (settings?.my_strips) {
      vmStrips = []
      vmStrips = settings.my_strips
    }

    api.onInoMessage(inoMessageHandler)
  })

  onDestroy(() => {
    try {
      clearInterval(timer)
      api.offInoMessage(inoMessageHandler)
    } catch (err) {}
  })
</script>

<div class="flex flex-col justify-center h-full">
  <div class="flex items-center gap-3 pb-4 mb-4 overflow-x-auto">
    {#if !vmStrips.length}
      <div class="text-center text-gray-500 w-full">No strips added</div>
    {:else}
      {#each vmStrips as { type, index, volume, volumePercentage, microphone, loud }, i}
        <div class="border border-gray-500 rounded p-4 w-full flex flex-col gap-3">
          <!-- Type -->
          <div>
            <div class="flex w-full">
              <button
                class="btn variant-{'win' == type
                  ? 'filled'
                  : 'soft'}-surface w-full rounded-r-none"
                on:click={() => {
                  vmStrips[i].type = 'win'
                  saveSettings()
                }}><Windows /></button
              >
              <button
                class="btn variant-{'vm' == type ? 'filled' : 'soft'}-surface w-full rounded-none"
                on:click={() => {
                  vmStrips[i].type = 'vm'
                  saveSettings()
                }}><MicFill /></button
              >
              <button
                class="btn variant-soft-surface p-2 ml-auto rounded-l-none"
                use:popup={{
                  event: 'click',
                  target: 'popupDelete_Strip_' + i,
                  placement: 'bottom'
                }}
              >
                <span class="text-gray-500"><XLg /></span>
              </button>
            </div>
          </div>

          <!-- Strip Title-->
          <div class="relative py-1">
            <div class="flex items-center gap-2">
              {#if 'vm' == type}
                <select
                  class="select w-full"
                  bind:value={index}
                  on:change={() => {
                    saveSettings()
                  }}
                >
                  {#each { length: 8 } as _, j}
                    <option value={j}>Strip {j + 1}</option>
                  {/each}
                </select>
              {:else}
                <select
                  class="select w-full"
                  bind:value={vmStrips[i].win_target_type}
                  on:change={() => {
                    saveSettings()
                  }}
                >
                  <option value="_main">Master volume</option>
                  <option value="_process">App volume</option>
                </select>

                {#if vmStrips[i].win_target_type == '_process'}
                  <select
                    class="select w-full"
                    bind:value={vmStrips[i].win_target}
                    on:change={() => {
                      saveSettings()
                    }}
                  >
                    {#each winApps as { pid, name }}
                      <option value="{name}|{pid}">{name}</option>
                    {/each}
                  </select>
                {/if}
              {/if}
            </div>
          </div>

          <!-- Volume -->
          <div class="inline-block">
            <div
              class="relative mx-auto flex aspect-[2] items-center justify-center overflow-hidden rounded-t-full bg-cyan-600 w-[100px] h-[50px]"
            >
              {#if 'vm' == type && loud}
                <!-- Outer ring with ranges (rotate angles modifiable to get custom range) -->
                <div
                  class="absolute top-0 aspect-square w-full rounded-full rotate-[calc(145deg-45deg)] bg-gradient-to-tr from-transparent from-50% to-red-500 to-50% transition-transform duration-500"
                ></div>
              {/if}
              <!-- Pointer -->
              <div
                class="absolute bg-white shadow-lg h-[120%] w-[5px] rounded-full bottom-0 origin-bottom right-[50%]"
                style="transform: rotate(calc({Math.round(
                  (((volumePercentage ?? 0) / 100) * 180 - 45) * 10
                ) / 10}deg - 45deg));"
              ></div>
              <!-- Actual gauge, change angle again for a dynamic value -->
              <div
                class="absolute top-8 flex aspect-square w-11/12 justify-center rounded-full bg-surface-900"
              ></div>
              <div
                class="absolute top-8 aspect-square w-11/12 rounded-full rotate-[calc(100deg-45deg)] bg-gradient-to-tr from-transparent from-50% to-surface-900 to-50% transition-transform duration-500"
              ></div>
              <div
                class="absolute top-1/3 flex aspect-square w-3/4 justify-center rounded-full bg-surface-900"
              ></div>
              <div class="absolute bottom-0 w-full truncate text-center text-[20px] leading-none">
                {volume ?? 0}
              </div>
            </div>
          </div>

          <!-- Microphone -->
          <div>
            <button
              class="btn variant-soft-surface w-full {microphone && micOn ? '!bg-white/10' : ''}"
              on:click|preventDefault={() => {
                for (let j = 0; j < vmStrips.length; j++) vmStrips[j].microphone = false
                vmStrips[i].microphone = true
                saveSettings()
              }}
            >
              <span class="flex flex-col gap-2 items-center">
                <span class="relative flex items-end gap-1">
                  {#if microphone}
                    <MicFill
                      class={micOn ? 'text-rose-500' : 'text-cyan-500'}
                      width={36}
                      height={36}
                    />
                  {:else}
                    <Mic class="text-gray-500" width={36} height={36} />
                  {/if}
                </span>
              </span>
            </button>
          </div>

          <!-- Allow Loud -->
          <div>
            <button
              class="btn variant-soft-surface w-full"
              disabled={'vm' !== type}
              on:click|preventDefault={() => {
                vmStrips[i].loud = !loud
                saveSettings()
              }}
            >
              <span class="flex flex-col gap-2 items-center">
                {#if loud}
                  <VolumeUp width={30} height={30} />
                {:else}
                  <VolumeDown width={30} height={30} />
                {/if}
                <span class="relative flex items-end gap-1">
                  <span
                    class="w-[7px] h-[10px] rounded-sm border {loud
                      ? 'bg-rose-500/70 border-rose-500/70'
                      : 'bg-white'}"
                  ></span>
                  <span
                    class="w-[7px] h-[15px] rounded-sm border {loud
                      ? 'bg-rose-500/70 border-rose-500/70'
                      : 'bg-white'}"
                  ></span>
                  <span
                    class="w-[7px] h-[20px] rounded-sm border {loud
                      ? 'bg-rose-500/70 border-rose-500/70'
                      : 'bg-white/10'}"
                  ></span>
                </span>
              </span>
            </button>
          </div>

          <!-- Popup -->
          <div class="card p-1 variant-filled-surface" data-popup="popupDelete_Strip_{i}">
            <button
              class="btn"
              on:click|preventDefault={() => {
                vmStrips = vmStrips.filter((_, j) => i !== j)
                saveSettings()
              }}>Remove</button
            >
            <div class="arrow variant-filled-surface" />
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <button
    class="btn variant-filled-surface text-center"
    on:click|preventDefault={() => {
      addStrip()
      saveSettings()
    }}
  >
    <Plus /><span class="inline-block">Add strip</span>
  </button>
</div>
