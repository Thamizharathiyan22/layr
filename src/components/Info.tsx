import { useState, type ReactNode } from 'react';
import { AD_SLOTS, APP_NAME, CONTACT_HINT, contactEmail, JURISDICTION, LEGAL_UPDATED, OWNER_NAME, SOURCE_URL } from '../brand';
import { navigate, type Route } from '../lib/router';
import { AdSlot, setConsent } from './Ads';
import { BestResults, DeviceDiagram, FaqList, Steps, WhyYourGpu } from './Explainers';
import Logo from './Logo';

export function Footer() {
  const L = ({ to, children }: { to: Route; children: ReactNode }) => (
    <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>{children}</a>
  );
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Logo onClick={() => navigate('/')} />
          <p className="muted small">Your photos never leave your device.</p>
        </div>
        <nav>
          <L to="/how-it-works">How it works</L>
          <L to="/privacy">Privacy</L>
          <L to="/terms">Terms</L>
          <L to="/licenses">Licences</L>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source code</a>
        </nav>
      </div>
      <p className="muted small copy">© {new Date().getFullYear()} {OWNER_NAME}. Code released under AGPL-3.0.</p>
    </footer>
  );
}

function Page({ title, updated, children }: { title: string; updated?: boolean; children: ReactNode }) {
  return (
    <main className="info">
      <nav className="nav">
        <Logo onClick={() => navigate('/')} />
        <button className="btn primary" onClick={() => navigate('/')}>Open the editor</button>
      </nav>
      <article className="info-body prose">
        <h1>{title}</h1>
        {updated && <p className="muted small">Last updated: {LEGAL_UPDATED}</p>}
        {children}
      </article>
      <Footer />
    </main>
  );
}

/** Email is only assembled when a real person clicks — keeps it away from spam bots. */
function Mail() {
  const [shown, setShown] = useState(false);
  if (shown) {
    const e = contactEmail();
    return <a href={`mailto:${e}`}>{e}</a>;
  }
  return (
    <span className="mail-hidden">
      {CONTACT_HINT}{' '}
      <button className="link" onClick={() => setShown(true)}>Show email</button>
    </span>
  );
}

export function HowItWorksPage() {
  return (
    <Page title="How it works">
      <p className="lead">
        {APP_NAME} puts your text <b>behind</b> the people and objects in a photo. Everything happens inside your browser.
      </p>
      <Steps />
      <h2>Where the work happens</h2>
      <DeviceDiagram />
      <WhyYourGpu />
      <h2>Tips for the best cutout</h2>
      <p>
        The AI looks for the main subject in your photo. It was trained mostly on real photos, so it is very good with people,
        cars and products. Very busy digital art can confuse it.
      </p>
      <BestResults />
      <h2>Questions</h2>
      <FaqList />
      <AdSlot slot={AD_SLOTS.info} className="ad-info" />
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy" updated>
      <p className="lead">Short version: your photos and text stay on your device. We never see them.</p>

      <h2>1. Your photos and text</h2>
      <p>
        {APP_NAME} processes images entirely inside your web browser. Your photos, the cutouts, the text you type and the final
        images are <b>never uploaded</b> to us or anyone else. We do not have a server that could store them.
      </p>

      <h2>2. What your browser downloads, and from whom</h2>
      <p>To work, your browser downloads files from these services. Like any website request, they can see your IP address and browser type:</p>
      <ul>
        <li><b>Our website host</b> (Cloudflare) – the website itself.</li>
        <li><b>Hugging Face</b> – the AI models, downloaded once and then kept in your browser.</li>
        <li><b>jsDelivr</b> – the AI engine files.</li>
        <li><b>Google Fonts</b> – the fonts.</li>
      </ul>
      <p>We do not receive any personal information from these downloads.</p>

      <h2>3. Things saved in your browser</h2>
      <p>
        We save small settings in your browser's local storage: whether your device should use the GPU or CPU, and your ad-cookie
        choice. The AI models are also stored in your browser's cache. You can clear all of this in your browser settings.
      </p>

      <h2>4. Advertising</h2>
      <p>
        To keep {APP_NAME} free we may show ads from <b>Google AdSense</b>. Ads load <b>only if you accept</b> ad cookies. If you
        accept, Google and its partners may use cookies to show and measure ads, and may personalise them based on your visits to
        this and other websites. Learn more in{' '}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">How Google uses information from sites that use its services</a>.
        You can opt out of personalised ads at{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ad Settings</a>.
      </p>
      <p><button className="btn ghost" onClick={() => setConsent(null)}>Change my ad-cookie choice</button></p>

      <h2>5. No accounts, no tracking of your work</h2>
      <p>There are no sign-ups and no analytics that record what you create.</p>

      <h2>6. Children</h2>
      <p>{APP_NAME} is not directed at children. If you are under 18, please use it with a parent or guardian's permission.</p>

      <h2>7. Your rights and contact</h2>
      <p>
        We hold no personal data about you, so there is nothing for us to share or delete. For any privacy question, including
        under India's Digital Personal Data Protection Act, 2023, or the EU GDPR, write to <Mail />.
      </p>

      <h2>8. Changes</h2>
      <p>If this policy changes, we will update the date at the top of this page.</p>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page title="Terms of Use" updated>
      <p className="lead">By using {APP_NAME} you agree to these terms. They are written to be easy to read.</p>

      <h2>1. The service</h2>
      <p>{APP_NAME} is a free tool that places text behind subjects in your photos. It runs in your browser. We may change or stop it at any time.</p>

      <h2>2. Your content and your responsibility</h2>
      <ul>
        <li>You keep all rights to your photos and the images you make. We claim no ownership.</li>
        <li>
          You must <b>own or have permission</b> to use every photo, logo, brand name, character and person's likeness you put in
          your images. For example, film characters, sports logos and celebrity photos usually belong to someone else.
        </li>
        <li>You are responsible for how you use the images, including in ads, which must follow advertising and consumer laws.</li>
      </ul>

      <h2>3. Not allowed</h2>
      <p>Do not use {APP_NAME} to make anything illegal, misleading, defamatory, hateful, harassing, or sexual content involving minors, or to impersonate someone.</p>

      <h2>4. AI limitations</h2>
      <p>The AI cutout can be wrong, especially on busy digital art. Always check your image before you publish it.</p>

      <h2>5. Open source</h2>
      <p>
        The source code of {APP_NAME} is public under the GNU Affero General Public License v3.0 (AGPL-3.0):{' '}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{SOURCE_URL}</a>.
      </p>

      <h2>6. No warranty</h2>
      <p>{APP_NAME} is provided "as is", without any warranty. To the extent the law allows, we are not liable for any loss or damage from using it.</p>

      <h2>7. Law</h2>
      <p>These terms are governed by the laws of {JURISDICTION}.</p>

      <h2>8. Contact and copyright complaints</h2>
      <p>Questions, or think something breaks these terms? Write to <Mail />.</p>
    </Page>
  );
}

export function LicensesPage() {
  const rows: [string, string, string, string][] = [
    [`${APP_NAME} website code`, 'This project', 'AGPL-3.0', SOURCE_URL],
    ['IS-Net cutout model (ISNet-ONNX)', 'Xuebin Qin et al. (DIS); ONNX conversion by onnx-community', 'AGPL-3.0 (as listed for this conversion)', 'https://huggingface.co/onnx-community/ISNet-ONNX'],
    ['SlimSAM tap-to-select model', 'Zigeng Chen et al.; based on Segment Anything by Meta AI', 'Apache-2.0', 'https://huggingface.co/Xenova/slimsam-77-uniform'],
    ['Transformers.js', 'Hugging Face', 'Apache-2.0', 'https://github.com/huggingface/transformers.js'],
    ['ONNX Runtime Web', 'Microsoft', 'MIT', 'https://github.com/microsoft/onnxruntime'],
    ['React', 'Meta', 'MIT', 'https://react.dev'],
    ['Vite', 'Vite contributors', 'MIT', 'https://vitejs.dev'],
    ['Fonts (55 families)', 'Various designers via Google Fonts', 'SIL Open Font License 1.1 or Apache-2.0 — free for commercial use', 'https://fonts.google.com'],
  ];
  return (
    <Page title="Licences & Credits">
      <p className="lead">{APP_NAME} is built on open-source work. Thank you to everyone below.</p>

      <h2>Why our code is public</h2>
      <p>
        The cutout model we use is shared under the <b>AGPL-3.0</b> licence. That licence lets anyone use it for free, including
        commercially, on one condition: if you run it as a website, you must share your website's source code under the same
        licence. So the full {APP_NAME} code is public here:{' '}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{SOURCE_URL}</a>.
      </p>

      <h2>Credits</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>What</th><th>By</th><th>Licence</th></tr></thead>
          <tbody>
            {rows.map(([what, by, lic, url]) => (
              <tr key={what}>
                <td><a href={url} target="_blank" rel="noopener noreferrer">{what}</a></td>
                <td>{by}</td>
                <td>{lic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Full licence texts are in the LICENSE file of the source code and on each project's page.</p>
    </Page>
  );
}
