param([string]$DocPath)

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($DocPath)
    Write-Host "OPEN_SUCCESS: $($doc.Name)"
    $doc.Close([ref]$false)
} catch {
    Write-Host "OPEN_FAILED: $($_.Exception.Message)"
} finally {
    $word.Quit()
}
