const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function testSingleCertificate() {
  const buf = fs.readFileSync('H:\\CERTIFICAT SCOLARITE 2025.docx');
  const zip = await JSZip.loadAsync(buf);

  // Read document.xml
  let docXml = await zip.file('word/document.xml').async('string');

  // We want to keep ONLY the first certificate page (section 0)
  // Let's locate the first sectPr
  const firstSectIdx = docXml.indexOf('</w:sectPr>');
  if (firstSectIdx > 0) {
    const bodyStart = docXml.indexOf('<w:body>') + '<w:body>'.length;
    const firstSectionContent = docXml.slice(bodyStart, firstSectIdx + '</w:sectPr>'.length);
    const newDocXml = docXml.slice(0, bodyStart) + firstSectionContent + '</w:body></w:document>';

    zip.file('word/document.xml', newDocXml);
    console.log('Single section document.xml created, length:', newDocXml.length);
  }

  // Replace header logo image3.jpeg with our infohas-logo.png
  const logoBuf = fs.readFileSync('F:\\Attendance\\public\\infohas-logo.png');
  // In word/media/image3.jpeg, we can overwrite it with our logo buffer!
  // Note: Word will render PNG in image3.jpeg if content-type or image bytes are valid
  zip.file('word/media/image3.jpeg', logoBuf);
  console.log('Replaced word/media/image3.jpeg with official logo');

  // Generate output docx
  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outPath = path.join(__dirname, 'test_certificate_output.docx');
  fs.writeFileSync(outPath, outBuf);
  console.log('Generated test certificate at:', outPath, 'size:', outBuf.length, 'bytes');
}

testSingleCertificate().catch(console.error);
