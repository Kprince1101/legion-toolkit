import rule from './no-rn-button.js';
import { runRule } from '../test-utils.js';

const RN_IMPORT = "import { Button, View } from 'react-native';\n";

runRule('no-rn-button', rule, {
  valid: [
    {
      code: "import { TouchableOpacity, Text } from 'react-native';\nexport const A = () => <TouchableOpacity onPress={go}><Text>Go</Text></TouchableOpacity>;",
    },
    {
      code: "import { Button } from '@/components/Button';\nexport const A = () => <Button onPress={go} />;",
    },
    {
      code: "import { View } from 'react-native';\nexport const A = () => <View />;",
    },
    {
      code: "import { Button as RNButton } from 'react-native';\nexport const A = () => <Button onPress={go} />;",
    },
  ],
  invalid: [
    {
      code: `${RN_IMPORT}export const A = () => <Button title="Go" onPress={go} />;`,
      errors: [{ messageId: 'rnButton' }],
    },
    {
      code: 'import { Button as RNButton } from \'react-native\';\nexport const A = () => <RNButton title="Go" onPress={go} />;',
      errors: [{ messageId: 'rnButton' }],
    },
  ],
});
