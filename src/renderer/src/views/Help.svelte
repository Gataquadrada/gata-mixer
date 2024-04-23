<script>
  import { onMount } from 'svelte'

  import {
    Windows,
    Mic,
    MicFill,
    VolumeDown,
    PiggyBankFill,
    BrowserSafari,
    Twitch,
    Twitter
  } from 'svelte-bootstrap-icons'

  $: appPath = ''

  onMount(async () => {
    // appPath = await api.appPath()
  })
</script>

<div class="flex gap-4 justify-center h-full">
  <div class="border border-gray-500 rounded p-4 w-full flex flex-col justify-center gap-6">
    <p>
      You can control VoiceMeeter<MicFill class="inline-block ml-1" height={12} width={12} /> Strips
      and Windows<Windows class="inline-block ml-1" height={12} width={12} /> Audio with this app.
    </p>
    <p>
      VoiceMeeter Strips are able to go above 100% Volume. Using the [<VolumeDown
        class="inline-block"
      />] button.
    </p>
    <p>
      If you followed my schematics/guide, the [Mic<Mic
        class="inline-block ml-1"
        height={12}
        width={12}
      />] Button can toggle Mute for both VoiceMeeter<MicFill
        class="inline-block ml-1"
        height={12}
        width={12}
      /> Strips and Windows<Windows class="inline-block ml-1" height={12} width={12} /> Audio.
    </p>
    <p>
      When controlling Windows<Windows class="inline-block ml-1" height={12} width={12} /> Audio, this
      app will try to avoid conflicts in case of multiple processes with same name. But an eventual conflict
      may happen. In that case, I suggest checking your strips and re-selecting the intended process.
    </p>
    <p>Consider supporting my creations.</p>

    {#if appPath}
      <p class="text-gray-500/50 text-xs">
        App Path:
        <a
          href="file://{appPath}"
          target="_blank"
          class="underline underline-offset-4 decoration-dotted"
        >
          {appPath}
        </a>
      </p>
    {/if}
  </div>
  <div class="border border-gray-500 rounded p-4 w-[33%] flex flex-col justify-center gap-3">
    <h4 class="h4">Support me</h4>
    <!-- Website -->
    <div class="flex gap-2 items-center">
      <span><PiggyBankFill /></span>
      <a
        href="https://buymeacoffee.com/gataquadrada"
        target="_blank"
        class="underline underline-offset-4 decoration-dotted">Buy me a coffee</a
      >
    </div>

    <!-- Website -->
    <div class="flex gap-2 items-center">
      <span><BrowserSafari /></span>
      <a
        href="https://gata.dev"
        target="_blank"
        class="underline underline-offset-4 decoration-dotted">Gata.Dev</a
      >
    </div>

    <h4 class="h4 mt-6">Socials</h4>
    <!-- Twitch -->
    <div class="flex gap-2 items-center">
      <span><Twitch /></span>
      <a
        href="https://twitch.tv/gataquadrada"
        target="_blank"
        class="underline underline-offset-4 decoration-dotted">Twitch</a
      >
    </div>

    <!-- Twitter -->
    <div class="flex gap-2 items-center">
      <span><Twitter /></span>
      <a
        href="https://twitter.com/gataquadrada"
        target="_blank"
        class="underline underline-offset-4 decoration-dotted">Twitter</a
      >
    </div>
  </div>
</div>
