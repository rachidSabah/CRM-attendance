param([string]$DocPath)

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $word.Documents.Open($DocPath)
    Write-Host "OPEN_SUCCESS: $($doc.Name)"
    $doc.Close([ref]$false)
} catch {
    Write-Host "OPEN_FAILED: $($_.Exception.Message)"
} finally {
    if ($word) {
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
