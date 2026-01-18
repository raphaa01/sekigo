import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from './ui/Card';
import Button from './ui/Button';
import './ImpressumView.css';

/**
 * Impressum View Component
 * 
 * Legal information page
 */
function ImpressumView() {
  const navigate = useNavigate();

  return (
    <div className="impressum-view">
      <Card padding="lg">
        <div className="impressum-view__header">
          <h1 className="impressum-view__title">Impressum</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/')}
          >
            Zurück
          </Button>
        </div>
        
        <div className="impressum-view__content">
          <section className="impressum-view__section">
            <h2 className="impressum-view__section-title">Angaben gemäß § 5 TMG</h2>
            <p>
              Go Platform<br />
              Beispielstraße 123<br />
              12345 Beispielstadt
            </p>
          </section>

          <section className="impressum-view__section">
            <h2 className="impressum-view__section-title">Kontakt</h2>
            <p>
              E-Mail: info@goplatform.example
            </p>
          </section>

          <section className="impressum-view__section">
            <h2 className="impressum-view__section-title">Haftung für Inhalte</h2>
            <p>
              Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. 
              Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte 
              können wir jedoch keine Gewähr übernehmen.
            </p>
          </section>

          <section className="impressum-view__section">
            <h2 className="impressum-view__section-title">Haftung für Links</h2>
            <p>
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren 
              Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten 
              Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten 
              verantwortlich.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}

export default ImpressumView;
