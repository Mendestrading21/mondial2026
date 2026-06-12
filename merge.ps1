# Fusionne data/patch.json (analyses manuelles Claude) dans data/resultats.json
$ErrorActionPreference = 'Stop'
$cur = Get-Content data/resultats.json -Raw -Encoding UTF8 | ConvertFrom-Json
$pat = Get-Content data/patch.json -Raw -Encoding UTF8 | ConvertFrom-Json

# 1) Nouvelles analyses (ajout/remplacement)
foreach ($p in $pat.analyses.PSObject.Properties) {
  if ($cur.analyses.PSObject.Properties[$p.Name]) { $cur.analyses.($p.Name) = $p.Value }
  else { $cur.analyses | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
}
# 2) Résultats patchés sur analyses existantes
foreach ($r in $pat.resultats.PSObject.Properties) {
  if ($cur.analyses.PSObject.Properties[$r.Name]) {
    $a = $cur.analyses.($r.Name)
    if ($a.PSObject.Properties['resultat']) { $a.resultat = $r.Value }
    else { $a | Add-Member -NotePropertyName 'resultat' -NotePropertyValue $r.Value }
  }
}
# 3) Classements
if (-not $cur.standings) { $cur | Add-Member -NotePropertyName 'standings' -NotePropertyValue ([pscustomobject]@{}) -Force }
foreach ($s in $pat.standings.PSObject.Properties) {
  if ($cur.standings.PSObject.Properties[$s.Name]) { $cur.standings.($s.Name) = $s.Value }
  else { $cur.standings | Add-Member -NotePropertyName $s.Name -NotePropertyValue $s.Value }
}
# 4) Briefing + news
$cur.briefing = $pat.briefing
if ($cur.PSObject.Properties['news']) { $cur.news = $pat.news } else { $cur | Add-Member -NotePropertyName 'news' -NotePropertyValue $pat.news }
# 5) Value bets recalculées
$value = @()
foreach ($p in $cur.analyses.PSObject.Properties) {
  $A = $p.Value
  if ($A.marche -and $A.marche.marches) {
    foreach ($x in $A.marche.marches) {
      if ($x.verdict -eq [char]::ConvertFromUtf32(0x1F7E2)) {
        $value += [pscustomobject]@{ id=$p.Name; titre=$A.titre; marche=$x.marche; proba=$x.proba; cote_min=$x.cote_min }
      }
    }
  }
}
$value = $value | Sort-Object -Property proba -Descending
if ($cur.PSObject.Properties['value']) { $cur.value = $value } else { $cur | Add-Member -NotePropertyName 'value' -NotePropertyValue $value }
$cur.generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

$json = $cur | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText("$PWD\data\resultats.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("OK - analyses: " + ($cur.analyses.PSObject.Properties | Measure-Object).Count + " / pistes vertes: " + ($value | Measure-Object).Count)
