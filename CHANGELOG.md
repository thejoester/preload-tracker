# Changelog
All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-05-19
### Added
- Added option to show the preload tracker window to players (disabled by default). When enabled, players see the same status window as the GM, without the Activate and Send to Chat buttons.
- When the GM clicks Activate, the tracker window is automatically closed for all players.

## [2.0.1] - 2026-04-29
### Changed
- Updated Polish localization. Credit [Lioheart](https://github.com/Lioheart)!
- Updated French localization. Credit [Rectulo](https://gitlocalize.com/users/rectulo)!

## [2.0.0] - 2026-04-13
### Changed
- **V14:** This release add official support for FoundryVTT v14!
### Added
- Added **Preload Scene** function to context menu in scene sidebar, now you can right-click scene in sidebar and preload the scene.

## [1.4.4] - 2026-04-04
### Changed
- Updated Polish localization. Credit [Lioheart](https://github.com/Lioheart)!
- Updated French localization. Credit [Rectulo](https://gitlocalize.com/users/rectulo)!

## [1.4.3] - 2026-03-02
### Changed
- Updated Polish localization. Credit [Lioheart](https://github.com/Lioheart)!

## [1.4.2] - 2026-03-01
### Changed
- Added setting to specifiy who to include in race results, `Players only` or `GM + Players`. Defaults to `Players only`

## [1.4.1] - 2026-02-25
### Fixed
- Included missing assets
- included updated en.json localization file

## [1.4.0] - 2026-02-25
### Added
- Added "Race Mode" option:
  - Shows race themed progress bar while pre-loading
  - Option to send results of 1st, 2nd, and 3rd place to chat. 

## [1.3.2] - 2026-02-09
### Changed
- Updated French localization. Credit [Rectulo](https://gitlocalize.com/users/rectulo)!
- Updated Polish localization. Credit [Lioheart](https://github.com/Lioheart)!

## [1.3.1] - 2026-01-22
### Fixed
- Fixed bug preventing scene preload functionality to work. ([Issue #12](https://github.com/thejoester/preload-tracker/issues/12))

## [1.3.0] - 2026-01-21
### Added
- Added tracker to preloading audio from playlists. Thanks: [LittleFluffy](https://github.com/LittleFluffy)!

## [1.2.9] - 2025-12-14
### Changed
- Updated to work with v12.

## [1.2.8] - 2025-10-25
### Changed
- Updated French localization. Credit [Rectulo](https://gitlocalize.com/users/rectulo)!

## [1.2.7] - 2025-10-20
### Changed
- Updated Polish localization. Credit [Lioheart](https://github.com/Lioheart)!

## [1.2.6] - 2025-10-18
### Added
- Added updating percentage display for each user while loading. 

## [1.2.5] - 2025-10-10
### Fixed
- Fixed bug causing `Cannot access 'MOD_ID' before initialization` error preventing loading of module.

## [1.2.4] - 2025-10-10
### Changed
- Cleaned up and consolidated code. 
### Added
- Added French localization. Credit [Rectulo](https://gitlocalize.com/users/rectulo)!

## [1.2.3] - 2025-10-06
### Changed
- Updated Github release to avoid manifest update messages in foundry.

## [1.2.2] - 2025-10-06
### Added
- Added Polish (pl) localization. Credit [Lioheart](https://github.com/Lioheart)!

## [1.2.1] - 2025-09-28
### Changed
- Clicking Activate will close the window and activate the scene. 

## 1.2.0 - 2025-09-25
### Added 
- Added "Activate" button, when all players done loading, will activate scene.
### Changed
- Succumbed to peer pressure and code ridicule, rewired code to utilize [libwrapper](https://github.com/ruipin/fvtt-lib-wrapper). 

## [1.0.1] - 2025-09-25
### Fixed
- Fixed module.json to contain manifest and download links.

## [1.0.0] - 2025-09-25
- Initial release of Preload Tracker
