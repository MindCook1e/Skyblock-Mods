# Score300 (ChatTriggers-Modul)

Ein ChatTriggers-Modul (CT 2.1.5, Minecraft 1.8.9) für Hypixel-SkyBlock-Dungeons.

## Funktionen
- **300-Score-Nachricht**: Chat-Nachricht, Titel und Sound, sobald der vorhergesagte Score 300 erreicht.
  Optional auch im Party-Chat.
- **Overlay** mit:
  - Zeit (`Time Elapsed` vom Scoreboard)
  - Mimic getötet: Ja/Nein
  - Crypts: x/5
  - aktueller Score + Rang
  - Zeitpunkt, an dem 300 erreicht wurde

## Installation
1. `ctjs-2.1.5-1.8.9.jar` in den `mods`-Ordner legen.
2. Den Ordner `Score300` nach `.minecraft/config/ChatTriggers/modules/` kopieren.
3. Im Spiel `/ct load` ausführen.

## Befehle
| Befehl | Funktion |
| --- | --- |
| `/score300 move` | Overlay verschieben (ziehen) und skalieren (Mausrad) |
| `/score300 toggle` | Overlay an/aus |
| `/score300 pc` | 300-Nachricht und Mimic-Kill in den Party-Chat senden an/aus |
| `/score300 paul` | Mayor Paul (EZPZ, +10 Bonus) an/aus |
| `/score300 mimic` | Mimic-Status manuell umschalten |
| `/score300 reset` | Aktuellen Run zurücksetzen |
| `/score300 test` | 300-Nachricht testen |

## Hinweise
- Der Score ist eine Vorhersage (wie bei Skytils): Blood- und Boss-Raum werden schon mitgezählt,
  die Nachricht heißt also „jetzt kann man in den Boss gehen“.
- Für den Speed-Score werden immer 100 Punkte angenommen. Der Spirit-Pet-Bonus beim ersten Tod
  wird nicht berücksichtigt (jeder Tod zählt −2), die Berechnung ist also eher vorsichtig.
- Mimic-Erkennung: ein Baby-Zombie ohne Rüstung stirbt, oder eine andere Mod meldet
  „Mimic Killed!“ im Party-Chat.
