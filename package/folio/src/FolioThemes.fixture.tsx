import {createTxtPlugin} from '@rezics/folio/plugin/txt';
import {FALLBACK_TEXT} from './_stubs';
import {FixtureShell} from './_fixture-helpers';

function setup() {
  const {plugin, tree} = createTxtPlugin(FALLBACK_TEXT.repeat(100));
  return {plugins: [plugin], tree};
}

function ScrollMode() {
  const {plugins, tree} = setup();
  return (
    <FixtureShell
      tree={tree}
      plugins={plugins}
      actions={[{type: 'SET_READ_MODE', mode: 'scroll'}]}
    />
  );
}

function PageMode() {
  const {plugins, tree} = setup();
  return <FixtureShell tree={tree} plugins={plugins} />;
}

function DarkTheme() {
  const {plugins, tree} = setup();
  return (
    <FixtureShell
      tree={tree}
      plugins={plugins}
      actions={[{type: 'SET_THEME', theme: 'dark'}]}
    />
  );
}

function SepiaTheme() {
  const {plugins, tree} = setup();
  return (
    <FixtureShell
      tree={tree}
      plugins={plugins}
      actions={[{type: 'SET_THEME', theme: 'sepia'}]}
    />
  );
}

export default {ScrollMode, PageMode, DarkTheme, SepiaTheme};
