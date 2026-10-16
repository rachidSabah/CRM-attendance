$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $filePath = 'C:\Users\piopi\Downloads\Certificat_Scolarite_YASMINE_IBNOGHAZALA_2025-2026.docx'
    $doc = $word.Documents.Open($filePath)
    Write-Host "SUCCESS: Word opened document! Title: $($doc.Name)"
    $doc.Close([ref]$false)
} catch {
    Write-Host "WORD OPEN FAILED: $($_.Exception.Message)"
} finally {
    if ($word) {
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
