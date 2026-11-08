import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('geometry', pathlib.Path(__file__).parents[1] / 'nodes' / 'geometry.py')
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)


class GeometryTests(unittest.TestCase):
    def test_moss_yxyx_and_metadata(self):
        state = {'version': 1, 'boxes': [{'x': 128, 'y': 192, 'width': 512, 'height': 384,
                 'type': 'text', 'text': '文字', 'desc': 'title', 'palette': ['#123ABC']}]}
        boxes = geometry.parse_state(state, 1024, 768)
        self.assertEqual(geometry.build_elements(boxes, 1024, 768),
                         [{'type': 'text', 'desc': 'title', 'text': '文字',
                           'bbox': [250, 125, 750, 625], 'color_palette': ['#123ABC']}])

    def test_reverse_and_clipping(self):
        boxes = geometry.parse_state({'version': 1, 'boxes': [{'x': 100, 'y': 100, 'width': -120, 'height': -200}]}, 1024, 768)
        self.assertEqual([boxes[0][k] for k in ('x', 'y', 'width', 'height')], [0, 0, 100, 100])

    def test_invalid_data_fails_clearly(self):
        for value in ('{}', '{', {'version': 1, 'boxes': [None]},
                      {'version': 1, 'boxes': [{'x': float('nan')}]},
                      {'version': 1, 'boxes': [{'x': 0, 'y': 0, 'width': 0, 'height': 2}]}):
            with self.assertRaises((ValueError, TypeError)):
                geometry.parse_state(value, 1024, 768)

    def test_empty_layout(self):
        self.assertEqual(geometry.build_elements(geometry.parse_state({'version': 1, 'boxes': []}, 1024, 768), 1024, 768), [])

    def test_linked_dimensions_shrink_with_regions_outside_new_canvas(self):
        state = {'version': 1, 'boxes': [
            {'x': 800, 'y': 700, 'width': 200, 'height': 100},
            {'x': 100, 'y': 100, 'width': 600, 'height': 400},
        ]}
        boxes = geometry.parse_state(state, 512, 384)
        self.assertEqual([boxes[0][k] for k in ('x', 'y', 'width', 'height')], [511, 383, 1, 1])
        self.assertEqual([boxes[1][k] for k in ('x', 'y', 'width', 'height')], [100, 100, 412, 284])


if __name__ == '__main__':
    unittest.main()
