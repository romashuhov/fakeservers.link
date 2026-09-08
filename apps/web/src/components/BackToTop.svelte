<script lang="ts">
	import { t } from "../lib/i18n.svelte";

	let visible = $state(false);

	$effect(() => {
		const onScroll = () => (visible = window.scrollY > 600);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	});
</script>

{#if visible}
	<button class="top" type="button" onclick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
		{t("top.button")}
	</button>
{/if}

<style>
	.top {
		position: fixed;
		right: 18px;
		bottom: 18px;
		z-index: 30;
		padding: 8px 14px;
		background: var(--ink);
		color: var(--bg);
		border: 2px solid var(--line);
		border-radius: 999px;
		box-shadow: var(--shadow);
		font-family: var(--mono);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.top:hover {
		background: var(--hi);
		color: #0f1a2a;
	}
	.top:active {
		transform: translate(3px, 3px);
		box-shadow: 1px 1px 0 var(--line);
	}
</style>
