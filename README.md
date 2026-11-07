# Dlinii Iraq offline data

Public **data-only** repository: `zitz5in-gif/dlinii-iraq-data`.
No application credentials, user data, or private application source belong here.

The manually triggered workflow prepares:

- `iraq.mbtiles`: actual Iraq Shortbread vector map from Geofabrik.
- `roads.tar`: Valhalla driving graph built from the Iraq OSM extract.
- `search.sqlite`: Arabic/English names and actual feature locations from the map.
- `iraq-package.json`: byte lengths, SHA-256 hashes and versioned HTTPS URLs.

The app's existing Download buttons fetch all three files and activate the version
only after every hash and database check succeeds. There is no import UI.

Data: © OpenStreetMap contributors, ODbL 1.0; extracts by Geofabrik.
https://www.openstreetmap.org/copyright
https://download.geofabrik.de/asia/iraq.html
Preserve attribution and ODbL obligations when distributing derived databases.

Workflow publication defaults to **false**. Downloading/building the graph and
passing sample routes are not proof of Android/iOS binary compatibility: test the
produced archive with the pinned mobile engine 0.6.4 before enabling publication.
The resolved container digest is recorded alongside build artifacts.

Once a tested public release is available, build Dlinii with:
`--dart-define=DLINII_IRAQ_PACKAGE_URL=https://github.com/zitz5in-gif/dlinii-iraq-data/releases/latest/download/iraq-package.json`

The repository is public. A runnable app download requires a completed, tested
data release; creating the repository alone does not provide one.
