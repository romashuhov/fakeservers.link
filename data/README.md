# Daily exports

One file per completed UTC day, `YYYY/MM/DD.json`, written by the collector and pushed to this
repository through the GitHub API. Fields:

- `date`, `generatedAt`
- `games[]`: per tracked game, the last snapshot of the day (`total`, `uniqueIps`, `uniqueSubnets`,
  `dup3`/`dup5`/`dup10`/`dup100` = addresses in identical-listing clusters of at least that size,
  `anonymous` = logged in without a game server token, `appeared`/`disappeared` since the previous
  run, `largestCluster`, `maxPerIp`, `maxPerSubnet`, `truncated` = the API cap was hit somewhere)
  and `hourly[]` with every snapshot of that day
- `totals`: the same counters summed over games
- `topClusters[]`: the 100 largest identical-listing clusters in the day's last snapshots

Full address lists are not stored here, only aggregates.
