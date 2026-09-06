import rule from './touchable-has-accessibility-label.js';
import { runRule } from '../test-utils.js';

runRule('touchable-has-accessibility-label', rule, {
  valid: [
    {
      code: 'export const A = () => <Pressable onPress={go}><Text>Save</Text></Pressable>;',
    },
    {
      code: 'export const A = () => <Pressable onPress={go} accessibilityLabel="Save"><Icon /></Pressable>;',
    },
    {
      code: 'export const A = () => <TouchableOpacity onPress={go}><View><Text>Save</Text></View></TouchableOpacity>;',
    },
    { code: 'export const A = () => <Pressable><Icon /></Pressable>;' },
    {
      code: 'export const A = () => <Pressable onPress={go}><><Text>Save</Text></></Pressable>;',
    },
    {
      code: 'export const A = () => <Pressable onPress={go}>{cond && <Text>Save</Text>}</Pressable>;',
    },
    {
      code: 'export const A = ({ p }) => <Pressable onPress={go} {...p}><Icon /></Pressable>;',
    },
    { code: 'export const A = () => <View onPress={go}><Icon /></View>;' },
  ],
  invalid: [
    {
      code: 'export const A = () => <Pressable onPress={go}><Icon /></Pressable>;',
      errors: [{ messageId: 'missingLabel', data: { name: 'Pressable' } }],
    },
    {
      code: 'export const A = () => <TouchableOpacity onPress={go}><Image source={s} /></TouchableOpacity>;',
      errors: [
        { messageId: 'missingLabel', data: { name: 'TouchableOpacity' } },
      ],
    },
  ],
});
