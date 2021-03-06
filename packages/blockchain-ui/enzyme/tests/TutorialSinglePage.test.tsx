import React from 'react';
import renderer from 'react-test-renderer';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import TutorialPage from '../../src/components/pages/TutorialSinglePage/TutorialSinglePage';
import ITutorialObject from '../../src/interfaces/ITutorialObject';

chai.should();
chai.use(sinonChai);

describe('TutorialPage component', () => {

    const tutorial: ITutorialObject = {
      title: 'a2',
      series: 'Basic tutorials',
      length: '4 weeks',
      objectives: [
          'objective 1',
          'objective 2',
          'objective 3'
      ],
      file: 'some/file/path',
      markdown: [
            '## Heading',
            'paragraph',
            '<img src="./relative/link" alt="alt"></img>',
            '<a href="mailto:a link">mailto ignore me</a>',
            '<a href="./resources/package.json">Link to resource file</a>',
            '<a href="./a1.md">Link to another tutorial</a>',
            '<a href="https://ibm.com">Link to external webpage</a>',
            '<a href="vscode:extension/someExtension">Link to a vscode extension page</a>',
            '<a>Bad anchor tag ignore me</a>',
            '<a href="./a1.md"><img src="./image/within/link" alt="alt"></img></a>',
            '```typescript\nconst astring: string = "string"\n```',
            '```\ncode block without language\n```',
            '`single line codeblock`',
            '<table><tr><td>Hello</td><td>World</td></tr></table>'
      ].join('\n'),
    };

    const tutorialData: Array<{name: string, tutorials: ITutorialObject[], tutorialFolder: string, tutorialDescription?: string}> = [
        {
            name: 'Basic tutorials',
            tutorialFolder: 'basic-tutorials',
            tutorialDescription: 'some description',
            tutorials: [
              {
                ...tutorial,
                title: 'a1',
                file: './a1.md',
              },
              tutorial,
              {
                ...tutorial,
                title: 'a3',
              },
            ]
        },
        {
            name: 'Other tutorials',
            tutorialFolder: 'other-tutorials',
            tutorials: [
                {
                    title: 'something really interesting',
                    series: 'Other tutorials',
                    length: '10 minutes',
                    objectives: [
                        'objective 1',
                        'objective 2',
                        'objective 3'
                    ],
                    file: 'another/file/path'
                }
            ]
        }
    ];

    let mySandBox: sinon.SinonSandbox;

    beforeEach(async () => {
        mySandBox = sinon.createSandbox();
    });

    afterEach(async () => {
        mySandBox.restore();
    });

    it('should render the expected snapshot', () => {
        const component: any = renderer
            .create(<TutorialPage tutorialData={tutorialData} tutorial={tutorial} />)
            .toJSON();
        expect(component).toMatchSnapshot();
    });

    it('should render the expected snapshot (when the style is dark)', () => {
        sinon.stub(document, 'getElementsByTagName').withArgs('body').returns([{ className: 'vscode-dark' }]);
        const component: any = renderer
            .create(<TutorialPage tutorialData={tutorialData} tutorial={tutorial} />)
            .toJSON();
        expect(component).toMatchSnapshot();
    });

    it('should render the component when no tutorialData is passed in', async () => {
        const component: any = renderer
              .create(<TutorialPage tutorialData={[]} tutorial={tutorial} />)
              .toJSON();
        expect(component).toMatchSnapshot();
    });
});
