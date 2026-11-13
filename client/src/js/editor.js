import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/gfm/gfm';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/addon/mode/overlay';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/selection/active-line';
import { LANGUAGES } from './document-utils.mjs';

export default class Editor {
  constructor(container, onChange, onCursorChange) {
    this.suspended = false;
    this.instance = CodeMirror(container, {
      value: '',
      mode: 'gfm',
      lineNumbers: true,
      lineWrapping: true,
      styleActiveLine: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      viewportMargin: 10,
      extraKeys: {
        'Tab': cm => {
          if (cm.somethingSelected()) cm.indentSelection('add');
          else cm.replaceSelection('  ', 'end');
        }
      }
    });
    this.instance.on('change', () => {
      if (!this.suspended) onChange(this.getValue());
    });
    this.instance.on('cursorActivity', () => {
      const cursor = this.instance.getCursor();
      onCursorChange(cursor.line + 1, cursor.ch + 1);
    });
  }

  setDocument(document) {
    this.suspended = true;
    this.instance.setOption('mode', (LANGUAGES[document.language] || LANGUAGES.plain).mode);
    this.instance.setValue(document.content || '');
    this.instance.clearHistory();
    this.suspended = false;
    this.instance.refresh();
  }

  setLanguage(language) {
    this.instance.setOption('mode', (LANGUAGES[language] || LANGUAGES.plain).mode);
  }

  setWrapping(enabled) {
    this.instance.setOption('lineWrapping', enabled);
  }

  getValue() { return this.instance.getValue(); }
  focus() { this.instance.focus(); }
  refresh() { this.instance.refresh(); }
}
