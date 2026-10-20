import fc from "fast-check";

// CI reruns the same cases so a red build is reproducible; local runs explore new ones.
if (import.meta.env["CI"]) fc.configureGlobal({ seed: 20261019 });
