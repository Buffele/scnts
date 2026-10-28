import { MantineProvider } from '@mantine/core';
import {createSpotlight, SpotlightActionData, Spotlight} from '@mantine/spotlight';
import { App as CustomApp } from './App/App';
import { ResourceClient } from './Utility/ResourceClient';
import {SpotlightActions} from "@mantine/spotlight/lib/Spotlight";

const app = new CustomApp();

let json: any;

const lastType = localStorage.getItem('last-type');
if (lastType === 'model') {
    const item = localStorage.getItem('model');
    if (item) {
        json = await ResourceClient.LoadScenes([item]);
    } else {
        json = await ResourceClient.LoadBGInfo('develop/preview.ini');
    }
} else if (lastType === 'bginfo') {
    const item = localStorage.getItem('bginfo');
    if (item) {
        json = await ResourceClient.LoadBGInfo(item);
    } else {
        json = await ResourceClient.LoadBGInfo('develop/preview.ini');
    }
} else {
    json = await ResourceClient.LoadBGInfo('develop/preview.ini');
}

await app.LoadFromJson(json);
await app.Run();

const maps = (await ResourceClient.GetBGInfos()).extended;
const models = (await ResourceClient.GetModels());

interface SpotlightActionExtended extends SpotlightActionData {
    titleL: string;
}

const actions: SpotlightActionExtended[] = [
    {
        id: 'toggle-dev-tools',
        title: 'Toggle Dev Tools',
        titleL: 'Toggle Dev Tools'.toLowerCase(),
        description: 'This toggles the dev tools.',
        //onTrigger: () => app.ToggleDevTools(),
    },
];

for (const map of maps) {
    actions.push({
        id: map.name,
        title: map.name,
        titleL: map.name.toLowerCase(),
        description: 'BG Info',
        //onTrigger: () => app.LoadBGInfo(map.name),
        // icon: <img src={map.previewImageUrl} alt={''} width={64} />,
    });
}

for (const model of models) {
    actions.push({
        id: model,
        title: model,
        titleL: model.toLowerCase(),
        description: 'Model',
        //onTrigger: () => app.LoadModel(model),
    });
}

const spotlightLimit = 30;

const filter = (query: string, actions_: SpotlightActions[]): SpotlightActions[] => {
    const results: SpotlightActionData[] = [];

    query = query.toLowerCase();

    let i = 0;

    for (const action of actions) {
        if (query === '') {
            results.push(action);
            i++;
        } else if (action.titleL.includes(query)) {
            results.push(action);
            i++;
        }

        if (i === spotlightLimit) {
            break;
        }
    }

    return results;
};

export const [firstStore, firstSpotlight] = createSpotlight();

export default function App() {
    return (
        <MantineProvider defaultColorScheme="dark">
            <Spotlight
                store={firstStore}
                actions={[]}
                shortcut={['mod + P', 'mod + K', 'mod + space', '/']}
                limit={spotlightLimit}
                nothingFound="Nothing found"
                filter={filter}
            >
            </Spotlight>
        </MantineProvider>
    );
}