# Roadmap

- [x] WW 2027 entry-alert sign-up: website HTML form, stores sign-ups, adds to Everlytic list 145818, emails the 2027 dates straight away (tested with Shaun). 1 Dec 09:00 campaign 923627 scheduled to all past WW lists + sign-ups.
- [ ] Publish so the website form works on the live domain.

- [x] Scheduled the personalized Weekend Warrior Lourensford thank-you through Everlytic for 20 October 2026 at 08:10 Johannesburg time (06:10 UTC), campaign 923462, dedicated list 145761. All 450 deliverable addresses have individual results read back from cfv_weekend_warrior_2026_lourensford_results30; existing contact messages, names and email status preserved. Of 516 valid addresses, excluded 29 bounced/bouncing, 36 prior unsubscribes and 1 provider conflict; 109 registration rows lacked a valid email. Concrete Mark Tew preview visually checked; overall field-size count omitted, official results button and both logo banners present. Three provider reads confirm pre-queue, is_scheduled=yes, epoch 1792476600, 450 to queue, 0 sent and send_date=0. Shaun-only schedule test 923461 cancelled; no duplicate test scheduled. Recipient-specific provider merge rendering cannot be inspected through the public online view; dedicated field and existing custom-tag syntax verified.

- [x] Connected Everlytic at the builder-confirmed installation; signed-in admin page reads campaigns and provides preview-to-Shaun and subscriber-campaign sending controls. Two safety tests pass; personalized thank-you content imported into the dedicated event audience and campaign 923462 scheduled.

- [x] Retrieved all eight daily lists and overall results; reviewed all ten podium categories, found 29 entry/course mismatches and six identity warnings, and emailed Shaun the complete 35-issue report. Timing feed remains intermittent; raw results preserved and timing-team confirmation is required.
- [x] Added admin-only anomaly flags and a fixed-recipient event-day report through the protected existing hourly callback; 21 tests passed, signed-in warning/report flow verified, unauthorized callback rejected, and full report send confirmed. Publication is required for automatic live event-day checks.

- [x] Verified Hannes Kriel #271 rode Bronze both days (52:03.77 + 44:49.51) despite a Silver entry; excluded mismatched timed courses from automatic weekend podiums, added admin mismatch review, and verified corrected Silver and other category leaders in the rider Results tab. All 10 tests passed; publishing needed.

- [x] Connect individual rider results and missing roster race numbers to the live timing feed; verified signed-in Natalie Stacey page: bib 753, Day 1 Gold position 232, time 4:41:20.96. Publishing is still needed for the live site.

- [x] Add and test recovery-session validation, missing/expired-link handling and account identity checks; confirm Michelle’s work account owns her entry.
- [ ] Confirm Michelle completes a password reset after publishing; waits on publication and her retry (no live account password changed during testing).

- [x] Move crew map controls and selected-rider actions above the map; add Google Maps and signed-in SOS resolution.
- [x] Verify the clean map and rider actions in signed-in race control and the unsigned medic view; resolution confirmation tested without changing a live alert.

- [x] Make the PE Plett route map the main Routes experience.
- [x] Add larger smooth zoom controls and a full-route recenter action.
- [x] Keep every configured route point visible on the interactive map.
- [x] Replace cropped route imagery with responsive animated SVG elevation profiles.
- [ ] Verify the PE Plett Routes experience on phone and desktop.
- [x] Build and test the Sea to Sea pre-event rider mailer.
- [x] Keep shared village-map location, point details and the app link clear on mobile.
- [x] Add undo for village editor point, tent, group and area moves.
- [ ] Verify the shared village map and editor undo on a real phone.