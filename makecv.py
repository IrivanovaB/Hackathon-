from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_fine_art_cv(filename="Eleanor_Wright_Fine_Art_CV.pdf"):
    # Target 1-page A4 setup
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom typography & styles
    name_style = ParagraphStyle(
        'NameStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#1A202C')
    )
    
    sub_style = ParagraphStyle(
        'SubStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#4A5568')
    )

    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#2B6CB0'),
        spaceAfter=3
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#2D3748')
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=body_style,
        leftIndent=10,
        spaceAfter=2
    )

    story = []

    # --- Header ---
    story.append(Paragraph("ELEANOR WRIGHT", name_style))
    story.append(Paragraph("<b>Manchester, UK (Northern Quarter, M4)</b> | eleanor.wright.art@example.co.uk | +44 7700 900821 | portfolio: eleanorwrightstudio.co.uk", sub_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E0'), spaceAfter=8))

    # --- Profile Summary ---
    story.append(Paragraph("PRACTICE & PROFILE", heading_style))
    story.append(Paragraph(
        "Emerging contemporary artist and Manchester School of Art graduate specializing in large-scale figurative oil painting, printmaking, and spatial installation. Deeply interested in the post-industrial architectural heritage of Greater Manchester and tactile material exploration. Seeking studio, curatorial, and creative project opportunities to expand independent practice and contribute to regional art initiatives.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # --- Education ---
    story.append(Paragraph("EDUCATION", heading_style))
    story.append(Paragraph("<b>BA (Hons) Fine Art (First Class Honours)</b> — Manchester School of Art (MMU) | <i>2021 – 2024</i>", body_style))
    story.append(Paragraph("• Focused on oil glaze techniques, silkscreen printing, and gallery installation design.", bullet_style))
    story.append(Paragraph("• Awarded the Dean’s Prize for Innovation in Contemporary Practice (2024).", bullet_style))
    story.append(Spacer(1, 8))

    # --- Exhibitions ---
    story.append(Paragraph("SELECTED GROUP EXHIBITIONS", heading_style))
    story.append(Paragraph("<b>Northern Voices: New Dimensions</b> — Castlefield Gallery, Manchester | <i>Nov 2024</i>", body_style))
    story.append(Paragraph("• Exhibited three large-format mixed-media panels exploring urban decay and regeneration.", bullet_style))
    story.append(Paragraph("<b>Hold Fast: MMU Degree Show</b> — Benzie Building, Manchester | <i>Jun 2024</i>", body_style))
    story.append(Paragraph("• Curated and installed a dedicated solo booth featuring 6 oil paintings and a soundscape.", bullet_style))
    story.append(Paragraph("<b>Open Print Showcase</b> — Salford Arts Club, Greater Manchester | <i>Mar 2023</i>", body_style))
    story.append(Spacer(1, 8))

    # --- Experience ---
    story.append(Paragraph("RELEVANT EXPERIENCE", heading_style))
    
    story.append(Paragraph("<b>Gallery & Invigilation Assistant</b> — HOME Manchester | <i>2023 – Present</i>", body_style))
    story.append(Paragraph("• Assisted curators with art handling, packing, wall-mounting, and lighting adjustments for international visiting artists.", bullet_style))
    story.append(Paragraph("• Welcomed over 1,500 weekly visitors, leading public tours and contextual gallery talks.", bullet_style))
    
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Studio Assistant (Internship)</b> — Islington Mill Arts Club, Salford | <i>2022 – 2023</i>", body_style))
    story.append(Paragraph("• Mixed pigments, prepped linen stretchers, and catalogued artworks for a resident professional painter.", bullet_style))
    story.append(Paragraph("• Managed inventory of chemicals, inks, and screens for the communal print studio.", bullet_style))
    story.append(Spacer(1, 8))

    # --- Skills & Technical Proficiency ---
    story.append(Paragraph("SKILLS & INTERESTS", heading_style))
    skills_data = [
        [
            Paragraph("<b>Fine Art Media:</b> Oil & acrylic painting, canvas stretching, lino & silkscreen printing, charcoal sketch.", body_style),
            Paragraph("<b>Digital & Technical:</b> Adobe Photoshop, InDesign, DSLR artwork photography, lighting setup.", body_style)
        ],
        [
            Paragraph("<b>Gallery Operations:</b> Art handling, white-glove packing, exhibition hanging, workshop facilitation.", body_style),
            Paragraph("<b>Artistic Interests:</b> Northern UK brutalism, community arts engagement, archival pigments, public sculpture.", body_style)
        ]
    ]
    t = Table(skills_data, colWidths=[260, 260])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t)

    # Build the PDF
    doc.build(story)
    print(f"✅ Generated single-page PDF: {filename}")

if __name__ == "__main__":
    generate_fine_art_cv()
    