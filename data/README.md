# data/

Test data removed — this is a template framework. Add your own test suite
workbooks (`.xlsx`) following the schema documented in the main README before running.

Expected structure (recreate as needed for your own project):
- `data/<your-module>/L1_High_Level/`, `L2_Mid_Level/`, `L3_Low_Level/` — test case workbooks at increasing detail levels
- `data/common/` — shared/reusable test case fragments referenced via `call_tc`
- `config/env_data/<your-module>/` — environment/fixture data (e.g. sample records referenced by test cases via `$env_data.*`)

None of the original project's data is included in this repository.
