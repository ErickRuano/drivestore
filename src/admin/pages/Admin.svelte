<script>
	let deployTriggered = false

	const deployTrigger = async ()=>{
		const results = fetch('https://api.vercel.com/v1/integrations/deploy/prj_LB7JXZla26aJK0aYjYzlNyU68Mas/HaEKTbdu5K', {
			method : 'POST'
		})
		console.log(results)
	}
</script>

<main>
	{#if deployTriggered}
		<h1>Your deployment will be in production in a minute!</h1>
	{:else}
		<h1>Hello!</h1>
		<button on:click={deployTrigger}>Update your DriveStore by clicking here:</button>
	{/if}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>