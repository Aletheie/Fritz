<svelte:head>
  <title>Wortly</title>
  <meta name="description" content="Local-first aplikace pro studium němčiny." />
</svelte:head>

<main>
  <h1>Wortly</h1>
  <p>Základ aplikace je připravený.</p>
</main>

<style>
  main {
    width: min(100% - 2rem, 48rem);
    margin: 0 auto;
    padding: 5rem 0;
  }

  h1 {
    margin: 0;
    font-size: clamp(3rem, 12vw, 7rem);
    line-height: 0.9;
  }

  p {
    font-size: 1.125rem;
  }
</style>
