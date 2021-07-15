<script>
	const deployTrigger = async ()=>{
		alert('deploy trigger')
	}
</script>

<main>
	<h1>Hello!</h1>
	<p on:click={deployTrigger}>Update your DriveStore by clicking here:</p>
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