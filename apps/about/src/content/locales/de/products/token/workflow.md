Ein Token ist wie ein Passwort zu behandeln. Bei einer sicheren Übergabe bleibt das Geheimnis außerhalb des Gesprächs mit der KI.

1. Der Agent verlangt einen eigenen Arbeitsbereich und erklärt, welche Dateien und Befehle er verwenden wird.
2. Der Agent darf eine leere `.env` anlegen und in `.gitignore` eintragen, hält aber vor der Eingabe von Zugangsdaten an.
3. Der Benutzer trägt `REZICS_API_TOKEN` lokal ein. Das Token darf nicht in einen KI-Chat kopiert werden: Eine direkte Übergabe an eine KI verursacht ein unvermeidbares Offenlegungsrisiko.
4. Der Code liest das Token ausschließlich aus der Prozessumgebung. Es darf weder ausgegeben noch in einer URL, einem Protokoll oder der Versionsverwaltung gespeichert werden.
5. Der Start erfolgt mit den geringsten notwendigen Berechtigungen und der Standard-Richtlinie. Der sichere Endpunkt zur Token-Selbstauskunft zeigt Identität, Berechtigungen und wirksame Grenzen, aber weder das Token noch andere Geheimnisse.
6. Die Automatisierung arbeitet mit begrenzten Stapeln, Prüfpunkten und verzögerten Wiederholungen. Nach Abschluss deaktiviert oder widerruft der Benutzer das Token.
