import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import build_pages


class StagingTest(unittest.TestCase):
    def test_scope(self):
        self.assertTrue(build_pages.is_offload_candidate('glowderm-research/assets/a.jpg'))
        self.assertTrue(build_pages.is_offload_candidate('hooks/video.mp4'))
        self.assertFalse(build_pages.is_offload_candidate('another-guide/assets/a.jpg'))
        self.assertFalse(build_pages.is_offload_candidate('glowderm-research/index.html'))

    def test_rewrite_pins_commit_and_preserves_unrelated_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            files={
                'glowderm-research/index.html':'<img src="assets/a.jpg"><a href="https://external.test/x.jpg">source</a>',
                'glowderm-research/references.json':'{"capture":"assets/a.jpg"}',
                'glowderm-research/assets/a.jpg':b'original image bytes',
                'another-guide/index.html':'<img src="a.jpg">',
                'another-guide/a.jpg':b'other image',
            }
            for name,body in files.items():
                path=root/name;path.parent.mkdir(parents=True,exist_ok=True)
                path.write_bytes(body if isinstance(body,bytes) else body.encode())
            sha='a'*40
            listing=('\0'.join(files)+'\0').encode()
            with patch.object(build_pages,'ROOT',root),patch.object(build_pages.subprocess,'check_output',side_effect=[listing,sha]):
                build_pages.build(root/'output')
            output=root/'output'
            expected=f'https://raw.githubusercontent.com/jehyeonyang-oss/chaakan-creator-guide/{sha}/glowderm-research/assets/a.jpg'
            self.assertIn(expected,(output/'glowderm-research/index.html').read_text())
            self.assertIn(expected,(output/'glowderm-research/references.json').read_text())
            self.assertFalse((output/'glowderm-research/assets/a.jpg').exists())
            self.assertEqual((root/'glowderm-research/assets/a.jpg').read_bytes(),b'original image bytes')
            self.assertEqual((output/'another-guide/index.html').read_text(),files['another-guide/index.html'])
            self.assertTrue((output/'another-guide/a.jpg').exists())
            manifest=json.loads((output/'deployment.json').read_text())
            self.assertEqual(manifest['offloaded_images'],1)
            self.assertEqual(manifest['offloaded_videos'],0)


if __name__=='__main__': unittest.main()
