# Contributing

## AIHUB compatibility in release notes

For every Customer Web release, record the minimum AIHUB commit SHA required by
that release in its release notes or release pull request. Include the routes
and response fields introduced by that AIHUB revision that the release needs.
If the release adds no new AIHUB dependency, carry forward the previous
release's minimum SHA. Verify that the required AIHUB revision has been
deployed before releasing the Customer Web.

Before rolling AIHUB back, operators must identify the deployed Customer Web
revision and compare its minimum AIHUB SHA with the rollback target. If the
target is older, first roll the Customer Web back to a compatible revision or
keep AIHUB on a compatible version. If either revision or the minimum SHA is
unknown, stop the rollback until compatibility is established. See the
[AIHUB rollback procedure](https://github.com/AiHub-Ecosystem/aihub-be/blob/main/docs/operations/deploy-vps.md#customer-web-compatibility-before-rollback).
